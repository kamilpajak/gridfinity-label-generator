import type { ChangelogEntry, ChangeCategory } from '$lib/types/changelog';

const CATEGORY_MAP: Record<string, ChangeCategory> = {
	added: 'added',
	changed: 'changed',
	fixed: 'fixed',
	removed: 'removed',
	improved: 'improved',
	deprecated: 'changed',
	security: 'fixed'
};

export function parseChangelog(content: string): ChangelogEntry[] {
	const entries: ChangelogEntry[] = [];

	// Match version headers: ## [1.2.3] - 2024-01-05
	// Also supports prerelease (1.0.0-beta.1) and build metadata (1.0.0+build.123)
	const versionRegex = /^## \[(\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?)\] - (\d{4}-\d{2}-\d{2})$/gm;
	const sections = content.split(versionRegex).slice(1); // Skip content before first version

	for (let i = 0; i < sections.length; i += 3) {
		const version = sections[i];
		const date = sections[i + 1];
		const body = sections[i + 2] || '';

		const changes = parseVersionBody(body);

		if (version && date) {
			entries.push({ version, date, changes });
		}
	}

	return entries;
}

function parseVersionBody(body: string): ChangelogEntry['changes'] {
	const changes: ChangelogEntry['changes'] = [];

	// Match category headers: ### Added, ### Fixed, etc.
	const categoryRegex = /^### (\w+)$/gm;
	const parts = body.split(categoryRegex).slice(1);

	for (let i = 0; i < parts.length; i += 2) {
		const categoryName = parts[i]?.toLowerCase();
		const items =
			parts[i + 1]
				?.split('\n')
				.filter((line) => line.trim().startsWith('-'))
				.map((line) => line.replace(/^-\s*/, '').trim())
				.filter(Boolean) || [];

		const category = CATEGORY_MAP[categoryName];
		if (category && items.length > 0) {
			changes.push({ category, items });
		}
	}

	return changes;
}

export function getRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();

	// Reset time parts to compare dates only
	const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const diffMs = nowOnly.getTime() - dateOnly.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	if (diffDays < 7) return `${diffDays} days ago`;
	if (diffDays < 14) return '1 week ago';
	if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
	if (diffDays < 60) return '1 month ago';
	return `${Math.floor(diffDays / 30)} months ago`;
}
