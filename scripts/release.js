#!/usr/bin/env node

/**
 * Hybrid Release Script
 *
 * Automatically determines version bump based on conventional commits,
 * but does NOT auto-generate changelog (manual changelog workflow).
 *
 * Usage:
 *   node scripts/release.js [--dry-run] [--release-as <major|minor|patch>]
 *
 * By default the bump is derived from conventional commits. Pass
 * --release-as to override it — e.g. a milestone major release that has no
 * BREAKING CHANGE commits.
 *
 * What it does:
 *   1. Analyzes commits since last tag
 *   2. Determines version bump (major/minor/patch), or uses --release-as
 *   3. Updates package.json version
 *   4. Creates git tag
 *   5. Pushes tag to origin
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = process.cwd();

const VALID_BUMPS = ['major', 'minor', 'patch'];

function parseReleaseAs() {
	const idx = process.argv.indexOf('--release-as');
	const value =
		idx !== -1
			? process.argv[idx + 1]
			: process.argv.find((a) => a.startsWith('--release-as='))?.split('=')[1];
	if (!value) return null;
	if (!VALID_BUMPS.includes(value)) {
		console.error(
			`❌ Invalid --release-as value: "${value}" (expected: ${VALID_BUMPS.join(', ')})`
		);
		process.exit(1);
	}
	return value;
}

const RELEASE_AS = parseReleaseAs();

function exec(cmd, options = {}) {
	if (DRY_RUN && !options.allowInDryRun) {
		console.log(`[DRY-RUN] Would execute: ${cmd}`);
		return '';
	}
	return execSync(cmd, { encoding: 'utf-8', ...options }).trim(); // NOSONAR - safe: all commands are hardcoded, no user input
}

function getLastTag() {
	try {
		return exec('git describe --tags --abbrev=0', { allowInDryRun: true });
	} catch {
		return null;
	}
}

function getCommitsSinceTag(tag) {
	const range = tag ? `${tag}..HEAD` : 'HEAD';
	const log = exec(`git log ${range} --pretty=format:"%s"`, { allowInDryRun: true });
	return log.split('\n').filter(Boolean);
}

function determineVersionBump(commits) {
	let bump = null;

	for (const commit of commits) {
		// Check for breaking changes
		if (commit.includes('BREAKING CHANGE') || commit.includes('!:')) {
			return 'major';
		}

		// Check for features
		if (commit.startsWith('feat:') || commit.startsWith('feat(')) {
			bump = bump === 'major' ? 'major' : 'minor';
		}

		// Check for fixes
		if (commit.startsWith('fix:') || commit.startsWith('fix(')) {
			bump = bump || 'patch';
		}
	}

	return bump;
}

function bumpVersion(currentVersion, bump) {
	const [major, minor, patch] = currentVersion.split('.').map(Number);

	switch (bump) {
		case 'major':
			return `${major + 1}.0.0`;
		case 'minor':
			return `${major}.${minor + 1}.0`;
		case 'patch':
			return `${major}.${minor}.${patch + 1}`;
		default:
			throw new Error(`Invalid bump type: ${bump}`);
	}
}

function updatePackageJson(newVersion) {
	const pkgPath = join(ROOT, 'package.json');
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
	const oldVersion = pkg.version;
	pkg.version = newVersion;

	if (!DRY_RUN) {
		writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
	}

	return oldVersion;
}

function checkChangelogUpdated(newVersion) {
	const changelogPath = join(ROOT, 'CHANGELOG.md');
	const changelog = readFileSync(changelogPath, 'utf-8');

	// Check if new version is documented
	if (!changelog.includes(`## [${newVersion}]`)) {
		console.error(`\n❌ CHANGELOG.md does not contain entry for version ${newVersion}`);
		console.error(`   Please update CHANGELOG.md before releasing.\n`);
		console.error(`   Expected: ## [${newVersion}] - YYYY-MM-DD\n`);
		process.exit(1);
	}
}

function main() {
	console.log('🚀 Hybrid Release Script\n');

	// Check for uncommitted changes
	const status = exec('git status --porcelain', { allowInDryRun: true });
	if (status && !DRY_RUN) {
		console.error('❌ Working directory has uncommitted changes. Commit or stash them first.');
		process.exit(1);
	}

	// Get current version
	const pkgPath = join(ROOT, 'package.json');
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
	const currentVersion = pkg.version;
	console.log(`📦 Current version: ${currentVersion}`);

	// Get last tag
	const lastTag = getLastTag();
	console.log(`🏷️  Last tag: ${lastTag || '(none)'}`);

	// Get commits since last tag
	const commits = getCommitsSinceTag(lastTag);
	console.log(`📝 Commits since last tag: ${commits.length}`);

	if (commits.length === 0) {
		console.log('\n✅ No commits since last tag. Nothing to release.');
		process.exit(0);
	}

	// Determine version bump (explicit override wins over commit analysis)
	const bump = RELEASE_AS || determineVersionBump(commits);

	if (!bump) {
		console.log('\n⚠️  No releasable commits found (no feat: or fix: commits).');
		process.exit(0);
	}

	const newVersion = bumpVersion(currentVersion, bump);
	console.log(
		`\n📈 Version bump: ${bump}${RELEASE_AS ? ' (forced via --release-as)' : ''} (${currentVersion} → ${newVersion})`
	);

	// Show commits that will be included
	console.log('\n📋 Commits in this release:');
	commits.forEach((c) => console.log(`   • ${c}`));

	// Check that CHANGELOG is updated
	console.log('\n📖 Checking CHANGELOG...');
	checkChangelogUpdated(newVersion);
	console.log('   ✅ CHANGELOG entry found');

	if (DRY_RUN) {
		console.log('\n🔍 DRY-RUN MODE - No changes will be made\n');
	}

	// Update package.json
	console.log('\n📝 Updating package.json...');
	updatePackageJson(newVersion);

	// Create commit
	console.log('💾 Creating release commit...');
	exec(`git add package.json`);
	exec(`git commit -m "chore(release): ${newVersion}"`);

	// Create tag
	console.log('🏷️  Creating tag...');
	exec(`git tag -a v${newVersion} -m "Release ${newVersion}"`);

	// Push
	console.log('🚀 Pushing to origin...');
	exec('git push origin HEAD');
	exec(`git push origin v${newVersion}`);

	console.log(`\n✅ Released version ${newVersion}!`);
	console.log(`   Tag: v${newVersion}`);
	console.log(`   GitHub will create the release automatically.\n`);
}

main();
