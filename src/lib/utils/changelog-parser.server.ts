import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseChangelog } from './changelog-parser';
import type { ChangelogEntry } from '$lib/types/changelog';

export interface AppMetadata {
	appVersion: string;
	changelog: ChangelogEntry[];
}

export function loadAppMetadata(): AppMetadata {
	// Read package.json for version
	let appVersion = '0.0.0';
	try {
		const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
		appVersion = packageJson.version || '0.0.0';
	} catch {
		console.warn('package.json not found or invalid');
	}

	// Read and parse CHANGELOG.md
	let changelog: ChangelogEntry[] = [];
	try {
		const changelogContent = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');
		changelog = parseChangelog(changelogContent);
	} catch {
		console.warn('CHANGELOG.md not found');
	}

	return { appVersion, changelog };
}
