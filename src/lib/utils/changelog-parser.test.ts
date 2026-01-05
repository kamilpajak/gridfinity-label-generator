import { describe, it, expect } from 'vitest';
import { parseChangelog, getRelativeDate } from './changelog-parser';

describe('parseChangelog', () => {
	it('parses a simple changelog with one version', () => {
		const content = `# Changelog

## [1.0.0] - 2024-01-05

### Added
- First feature
- Second feature

### Fixed
- Bug fix one
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(1);
		expect(result[0].version).toBe('1.0.0');
		expect(result[0].date).toBe('2024-01-05');
		expect(result[0].changes).toHaveLength(2);
		expect(result[0].changes[0]).toEqual({
			category: 'added',
			items: ['First feature', 'Second feature']
		});
		expect(result[0].changes[1]).toEqual({
			category: 'fixed',
			items: ['Bug fix one']
		});
	});

	it('parses multiple versions in correct order', () => {
		const content = `# Changelog

## [2.0.0] - 2024-02-01

### Added
- New major feature

## [1.1.0] - 2024-01-15

### Improved
- Performance boost

## [1.0.0] - 2024-01-05

### Added
- Initial release
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(3);
		expect(result[0].version).toBe('2.0.0');
		expect(result[1].version).toBe('1.1.0');
		expect(result[2].version).toBe('1.0.0');
	});

	it('handles prerelease versions', () => {
		const content = `# Changelog

## [1.0.0-beta.1] - 2024-01-05

### Added
- Beta feature
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(1);
		expect(result[0].version).toBe('1.0.0-beta.1');
	});

	it('handles build metadata in versions', () => {
		const content = `# Changelog

## [1.0.0+build.123] - 2024-01-05

### Added
- Feature with build metadata
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(1);
		expect(result[0].version).toBe('1.0.0+build.123');
	});

	it('handles prerelease with build metadata', () => {
		const content = `# Changelog

## [1.0.0-rc.1+build.456] - 2024-01-05

### Added
- Release candidate feature
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(1);
		expect(result[0].version).toBe('1.0.0-rc.1+build.456');
	});

	it('maps deprecated to changed category', () => {
		const content = `# Changelog

## [1.0.0] - 2024-01-05

### Deprecated
- Old API endpoint
`;

		const result = parseChangelog(content);

		expect(result[0].changes[0].category).toBe('changed');
	});

	it('maps security to fixed category', () => {
		const content = `# Changelog

## [1.0.0] - 2024-01-05

### Security
- Fixed XSS vulnerability
`;

		const result = parseChangelog(content);

		expect(result[0].changes[0].category).toBe('fixed');
	});

	it('ignores unknown categories', () => {
		const content = `# Changelog

## [1.0.0] - 2024-01-05

### Unknown
- Something unknown

### Added
- Valid feature
`;

		const result = parseChangelog(content);

		expect(result[0].changes).toHaveLength(1);
		expect(result[0].changes[0].category).toBe('added');
	});

	it('returns empty array for empty changelog', () => {
		const content = `# Changelog

All notable changes will be documented here.
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(0);
	});

	it('handles entries with no changes', () => {
		const content = `# Changelog

## [1.0.0] - 2024-01-05

No changes in this version.
`;

		const result = parseChangelog(content);

		expect(result).toHaveLength(1);
		expect(result[0].changes).toHaveLength(0);
	});

	it('handles all supported categories', () => {
		const content = `# Changelog

## [1.0.0] - 2024-01-05

### Added
- New feature

### Changed
- Modified behavior

### Fixed
- Bug fix

### Removed
- Deprecated feature

### Improved
- Performance improvement
`;

		const result = parseChangelog(content);

		expect(result[0].changes).toHaveLength(5);
		expect(result[0].changes.map((c) => c.category)).toEqual([
			'added',
			'changed',
			'fixed',
			'removed',
			'improved'
		]);
	});
});

describe('getRelativeDate', () => {
	it('returns "Today" for today\'s date', () => {
		const today = new Date().toISOString().split('T')[0];
		expect(getRelativeDate(today)).toBe('Today');
	});

	it('returns "Yesterday" for yesterday\'s date', () => {
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		expect(getRelativeDate(yesterday)).toBe('Yesterday');
	});

	it('returns "X days ago" for dates within a week', () => {
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		expect(getRelativeDate(threeDaysAgo)).toBe('3 days ago');
	});

	it('returns "1 week ago" for dates 7-13 days ago', () => {
		const oneWeekAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		expect(getRelativeDate(oneWeekAgo)).toBe('1 week ago');
	});

	it('returns "X weeks ago" for dates 2-4 weeks ago', () => {
		const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];
		expect(getRelativeDate(threeWeeksAgo)).toBe('3 weeks ago');
	});

	it('returns "1 month ago" for dates 30-59 days ago', () => {
		const oneMonthAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		expect(getRelativeDate(oneMonthAgo)).toBe('1 month ago');
	});

	it('returns "X months ago" for older dates', () => {
		const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];
		expect(getRelativeDate(threeMonthsAgo)).toBe('3 months ago');
	});
});
