/**
 * Env Var Documentation Tests
 *
 * Guards against a deployment-only failure mode: code starts reading a new
 * `PUBLIC_*` env var, the operator never learns it exists, and the feature it
 * controls silently stops working in production while every unit test stays green.
 *
 * This happened with `PUBLIC_ALLOWED_ORIGINS` — the QR URL shortener returned 403
 * on the live site for three months because the deploy never set it, and the
 * endpoint's own tests mock the variable to a working value.
 *
 * These tests read the real source tree and the real docs, and mock nothing.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC_DIR = resolve(process.cwd(), 'src');
const ENV_EXAMPLE = resolve(process.cwd(), '.env.example');
const DEPLOYMENT_GUIDE = resolve(process.cwd(), 'docs/guides/deployment.md');

const SOURCE_FILE_PATTERN = /\.(ts|svelte)$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|js)$/;

/** Matches a full SCREAMING_SNAKE_CASE name, so `PUBLIC_AFFILIATE_*` in prose is not a hit. */
const ENV_VAR_PATTERN = /\bPUBLIC_[A-Z0-9]+(?:_[A-Z0-9]+)*\b/g;

const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_PATTERN = /(^|[^:])\/\/[^\n]*/g;

/**
 * Without this variable the shortener rejects its own site with 403, so the
 * copy-paste `docker run` block — not just the reference table — has to carry it.
 */
const SHORTENER_ORIGIN_VAR = 'PUBLIC_ALLOWED_ORIGINS';

function listSourceFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			listSourceFiles(path, found);
		} else if (SOURCE_FILE_PATTERN.test(path) && !TEST_FILE_PATTERN.test(path)) {
			found.push(path);
		}
	}
	return found;
}

/** Strips comments so a variable mentioned only in a doc comment does not count as read. */
function stripComments(source: string): string {
	return source.replace(BLOCK_COMMENT_PATTERN, '').replace(LINE_COMMENT_PATTERN, '$1');
}

/** Every `PUBLIC_*` variable the shipped app actually reads, mapped to where it is read. */
function findEnvVarsReadBySource(): Map<string, string> {
	const vars = new Map<string, string>();
	for (const file of listSourceFiles(SRC_DIR)) {
		const code = stripComments(readFileSync(file, 'utf8'));
		for (const match of code.matchAll(ENV_VAR_PATTERN)) {
			if (!vars.has(match[0])) {
				vars.set(match[0], file);
			}
		}
	}
	return vars;
}

function undocumentedIn(docPath: string): string[] {
	const doc = readFileSync(docPath, 'utf8');
	return [...findEnvVarsReadBySource().keys()].filter((name) => !doc.includes(name)).sort();
}

describe('PUBLIC_* env var documentation', () => {
	it('finds the env vars the app reads', () => {
		const vars = findEnvVarsReadBySource();

		// Sanity check on the scanner itself: a known variable must be picked up,
		// otherwise an empty result would make the assertions below vacuous.
		expect(vars.has(SHORTENER_ORIGIN_VAR)).toBe(true);
	});

	it('lists every env var the app reads in .env.example', () => {
		expect(undocumentedIn(ENV_EXAMPLE)).toEqual([]);
	});

	it('documents every env var the app reads in the deployment guide', () => {
		expect(undocumentedIn(DEPLOYMENT_GUIDE)).toEqual([]);
	});

	it('includes the shortener origin allowlist in a docker run example', () => {
		const guide = readFileSync(DEPLOYMENT_GUIDE, 'utf8');

		const runExamples = guide.split('docker run').slice(1);
		const examplesWithVar = runExamples.filter((example) => example.includes(SHORTENER_ORIGIN_VAR));

		expect(runExamples.length).toBeGreaterThan(0);
		expect(examplesWithVar).toHaveLength(runExamples.length);
	});
});
