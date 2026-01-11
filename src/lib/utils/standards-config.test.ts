/**
 * Tests for standards-config.ts
 *
 * TDD approach: tests written first, then implementation.
 *
 * @see docs/plan-standards-config-migration.md
 */

import { describe, it, expect } from 'vitest';
import {
	parseStandardId,
	buildStandardId,
	extractAllStandardIds,
	getStandardEntry,
	isWithdrawn,
	type StandardSystem,
	type StandardEntry,
	type StandardsConfig
} from './standards-config';

describe('standards-config', () => {
	describe('parseStandardId', () => {
		it('parses ISO standard ID', () => {
			expect(parseStandardId('iso4762')).toEqual({ system: 'iso', number: '4762' });
		});

		it('parses DIN standard ID', () => {
			expect(parseStandardId('din912')).toEqual({ system: 'din', number: '912' });
		});

		it('parses ID with letter suffix (variant)', () => {
			expect(parseStandardId('din7504k')).toEqual({ system: 'din', number: '7504k' });
			expect(parseStandardId('iso15071a')).toEqual({ system: 'iso', number: '15071a' });
		});

		it('handles uppercase input', () => {
			expect(parseStandardId('ISO4762')).toEqual({ system: 'iso', number: '4762' });
			expect(parseStandardId('DIN912')).toEqual({ system: 'din', number: '912' });
		});

		it('handles mixed case input', () => {
			expect(parseStandardId('Iso4762')).toEqual({ system: 'iso', number: '4762' });
			expect(parseStandardId('DiN912')).toEqual({ system: 'din', number: '912' });
		});

		it('parses future systems (ANSI, PN, GB, JIS)', () => {
			expect(parseStandardId('ansi123')).toEqual({ system: 'ansi', number: '123' });
			expect(parseStandardId('pn456')).toEqual({ system: 'pn', number: '456' });
			expect(parseStandardId('gb789')).toEqual({ system: 'gb', number: '789' });
			expect(parseStandardId('jis101')).toEqual({ system: 'jis', number: '101' });
		});

		it('returns null for invalid input', () => {
			expect(parseStandardId('')).toBeNull();
			expect(parseStandardId('invalid')).toBeNull();
			expect(parseStandardId('iso')).toBeNull();
			expect(parseStandardId('4762')).toBeNull();
			expect(parseStandardId('iso-4762')).toBeNull();
			expect(parseStandardId('iso 4762')).toBeNull();
		});

		it('returns null for unsupported systems', () => {
			expect(parseStandardId('bs123')).toBeNull();
			expect(parseStandardId('astm456')).toBeNull();
		});

		it('handles edge cases', () => {
			// @ts-expect-error - testing runtime behavior with invalid input
			expect(parseStandardId(null)).toBeNull();
			// @ts-expect-error - testing runtime behavior with invalid input
			expect(parseStandardId(undefined)).toBeNull();
			// @ts-expect-error - testing runtime behavior with invalid input
			expect(parseStandardId(123)).toBeNull();
		});
	});

	describe('buildStandardId', () => {
		it('builds ISO standard ID', () => {
			expect(buildStandardId('iso', '4762')).toBe('iso4762');
		});

		it('builds DIN standard ID', () => {
			expect(buildStandardId('din', '912')).toBe('din912');
		});

		it('builds ID with letter suffix', () => {
			expect(buildStandardId('din', '7504k')).toBe('din7504k');
		});

		it('builds IDs for future systems', () => {
			expect(buildStandardId('ansi', '123')).toBe('ansi123');
			expect(buildStandardId('pn', '456')).toBe('pn456');
			expect(buildStandardId('gb', '789')).toBe('gb789');
			expect(buildStandardId('jis', '101')).toBe('jis101');
		});
	});

	describe('extractAllStandardIds', () => {
		it('extracts IDs from ISO section', () => {
			const config: StandardsConfig = {
				iso: {
					'4762': { din: ['912'] },
					'4017': { din: ['933'] }
				}
			};

			const ids = extractAllStandardIds(config);

			expect(ids).toContain('iso4762');
			expect(ids).toContain('iso4017');
			expect(ids).toHaveLength(2);
		});

		it('extracts IDs from DIN section', () => {
			const config: StandardsConfig = {
				din: {
					'95': {},
					'127': { withdrawn: true }
				}
			};

			const ids = extractAllStandardIds(config);

			expect(ids).toContain('din95');
			expect(ids).toContain('din127');
			expect(ids).toHaveLength(2);
		});

		it('extracts IDs from multiple sections', () => {
			const config: StandardsConfig = {
				iso: {
					'4762': { din: ['912'] }
				},
				din: {
					'95': {}
				}
			};

			const ids = extractAllStandardIds(config);

			expect(ids).toContain('iso4762');
			expect(ids).toContain('din95');
			expect(ids).toHaveLength(2);
		});

		it('handles empty config', () => {
			const config: StandardsConfig = {};
			expect(extractAllStandardIds(config)).toEqual([]);
		});

		it('handles empty sections', () => {
			const config: StandardsConfig = {
				iso: {},
				din: {}
			};
			expect(extractAllStandardIds(config)).toEqual([]);
		});

		it('extracts IDs from future systems', () => {
			const config: StandardsConfig = {
				ansi: { '123': {} },
				pn: { '456': {} },
				gb: { '789': {} },
				jis: { '101': {} }
			};

			const ids = extractAllStandardIds(config);

			expect(ids).toContain('ansi123');
			expect(ids).toContain('pn456');
			expect(ids).toContain('gb789');
			expect(ids).toContain('jis101');
		});
	});

	describe('getStandardEntry', () => {
		const config: StandardsConfig = {
			iso: {
				'4762': { din: ['912'] },
				'1051': { din: ['660'], withdrawn: true }
			},
			din: {
				'95': {},
				'7991': { withdrawn: true, replacedBy: 'iso10642' }
			}
		};

		it('gets ISO standard entry', () => {
			const entry = getStandardEntry(config, 'iso4762');

			expect(entry).toEqual({ din: ['912'] });
		});

		it('gets DIN standard entry', () => {
			const entry = getStandardEntry(config, 'din7991');

			expect(entry).toEqual({ withdrawn: true, replacedBy: 'iso10642' });
		});

		it('gets empty entry', () => {
			const entry = getStandardEntry(config, 'din95');

			expect(entry).toEqual({});
		});

		it('returns undefined for non-existent standard', () => {
			expect(getStandardEntry(config, 'iso9999')).toBeUndefined();
			expect(getStandardEntry(config, 'din9999')).toBeUndefined();
		});

		it('returns undefined for invalid ID', () => {
			expect(getStandardEntry(config, 'invalid')).toBeUndefined();
			expect(getStandardEntry(config, '')).toBeUndefined();
		});

		it('returns undefined for non-existent system', () => {
			expect(getStandardEntry(config, 'ansi123')).toBeUndefined();
		});
	});

	describe('isWithdrawn', () => {
		const config: StandardsConfig = {
			iso: {
				'4762': { din: ['912'] },
				'1051': { din: ['660'], withdrawn: true }
			},
			din: {
				'95': {},
				'127': { withdrawn: true },
				'7991': { withdrawn: true, replacedBy: 'iso10642' }
			}
		};

		it('returns true for withdrawn standard', () => {
			expect(isWithdrawn(config, 'iso1051')).toBe(true);
			expect(isWithdrawn(config, 'din127')).toBe(true);
			expect(isWithdrawn(config, 'din7991')).toBe(true);
		});

		it('returns false for current standard', () => {
			expect(isWithdrawn(config, 'iso4762')).toBe(false);
			expect(isWithdrawn(config, 'din95')).toBe(false);
		});

		it('returns false for non-existent standard', () => {
			expect(isWithdrawn(config, 'iso9999')).toBe(false);
			expect(isWithdrawn(config, 'invalid')).toBe(false);
		});
	});

	describe('type exports', () => {
		it('StandardSystem type includes all valid systems', () => {
			const systems: StandardSystem[] = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];
			expect(systems).toHaveLength(6);
		});

		it('StandardEntry type allows all valid fields', () => {
			const entry: StandardEntry = {
				din: ['912'],
				iso: ['4762'],
				ansi: ['B18.3'],
				pn: ['123'],
				withdrawn: true,
				replacedBy: 'iso10642'
			};
			expect(entry.withdrawn).toBe(true);
		});

		it('StandardsConfig type allows system sections', () => {
			const config: StandardsConfig = {
				iso: { '4762': {} },
				din: { '912': {} },
				ansi: { '123': {} }
			};
			expect(Object.keys(config)).toHaveLength(3);
		});
	});
});
