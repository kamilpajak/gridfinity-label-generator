/**
 * DIN Media Search Utilities Tests (TDD)
 *
 * Phase 3 revised: DIN Media as single source of truth for all standards.
 * Tests for search query generation and standard ID extraction.
 *
 * @see docs/plan-standards-validation-pipeline.md
 */

import { describe, it, expect } from 'vitest';
import {
	standardIdToSearchQuery,
	extractStandardIdsFromConfig,
	isIsoStandard,
	isDinStandard
} from './dinmedia-search';

describe('standardIdToSearchQuery', () => {
	describe('DIN standards', () => {
		it('should convert din912 to "DIN 912"', () => {
			expect(standardIdToSearchQuery('din912')).toBe('DIN 912');
		});

		it('should convert din7991 to "DIN 7991"', () => {
			expect(standardIdToSearchQuery('din7991')).toBe('DIN 7991');
		});

		it('should handle variant suffix (din7504k -> "DIN 7504")', () => {
			expect(standardIdToSearchQuery('din7504k')).toBe('DIN 7504');
		});

		it('should handle uppercase input', () => {
			expect(standardIdToSearchQuery('DIN912')).toBe('DIN 912');
		});
	});

	describe('ISO standards - search as EN ISO', () => {
		it('should convert iso4762 to "EN ISO 4762" for European adoption search', () => {
			expect(standardIdToSearchQuery('iso4762')).toBe('EN ISO 4762');
		});

		it('should convert iso4026 to "EN ISO 4026"', () => {
			expect(standardIdToSearchQuery('iso4026')).toBe('EN ISO 4026');
		});

		it('should convert iso10642 to "EN ISO 10642"', () => {
			expect(standardIdToSearchQuery('iso10642')).toBe('EN ISO 10642');
		});

		it('should handle uppercase input', () => {
			expect(standardIdToSearchQuery('ISO4762')).toBe('EN ISO 4762');
		});
	});

	describe('invalid inputs', () => {
		it('should return null for invalid format', () => {
			expect(standardIdToSearchQuery('ansi123')).toBeNull();
		});

		it('should return null for empty string', () => {
			expect(standardIdToSearchQuery('')).toBeNull();
		});

		it('should return null for number only', () => {
			expect(standardIdToSearchQuery('4762')).toBeNull();
		});
	});
});

describe('extractStandardIdsFromConfig', () => {
	it('should extract ISO IDs from crossref section', () => {
		const config = {
			crossref: {
				iso4762: { din: ['912'] },
				iso7380: { din: ['9427'] }
			},
			dinOnly: {}
		};

		const ids = extractStandardIdsFromConfig(config);
		expect(ids).toContain('iso4762');
		expect(ids).toContain('iso7380');
	});

	it('should extract DIN IDs from dinOnly section', () => {
		const config = {
			crossref: {},
			dinOnly: {
				din912: { description: 'Test' },
				din7991: { description: 'Test' }
			}
		};

		const ids = extractStandardIdsFromConfig(config);
		expect(ids).toContain('din912');
		expect(ids).toContain('din7991');
	});

	it('should combine IDs from both sections', () => {
		const config = {
			crossref: {
				iso4762: { din: ['912'] }
			},
			dinOnly: {
				din125: { description: 'Washers' }
			}
		};

		const ids = extractStandardIdsFromConfig(config);
		expect(ids).toHaveLength(2);
		expect(ids).toContain('iso4762');
		expect(ids).toContain('din125');
	});

	it('should return lowercase IDs', () => {
		const config = {
			crossref: { ISO4762: { din: ['912'] } },
			dinOnly: { DIN912: { description: 'Test' } }
		};

		const ids = extractStandardIdsFromConfig(config);
		expect(ids.every((id) => id === id.toLowerCase())).toBe(true);
	});

	it('should handle empty config', () => {
		const config = { crossref: {}, dinOnly: {} };
		const ids = extractStandardIdsFromConfig(config);
		expect(ids).toHaveLength(0);
	});
});

describe('isIsoStandard', () => {
	it('should return true for ISO IDs', () => {
		expect(isIsoStandard('iso4762')).toBe(true);
		expect(isIsoStandard('iso10642')).toBe(true);
		expect(isIsoStandard('ISO4762')).toBe(true);
	});

	it('should return false for DIN IDs', () => {
		expect(isIsoStandard('din912')).toBe(false);
		expect(isIsoStandard('din7991')).toBe(false);
	});

	it('should return false for invalid IDs', () => {
		expect(isIsoStandard('ansi123')).toBe(false);
		expect(isIsoStandard('')).toBe(false);
	});
});

describe('isDinStandard', () => {
	it('should return true for DIN IDs', () => {
		expect(isDinStandard('din912')).toBe(true);
		expect(isDinStandard('din7991')).toBe(true);
		expect(isDinStandard('DIN912')).toBe(true);
	});

	it('should return false for ISO IDs', () => {
		expect(isDinStandard('iso4762')).toBe(false);
		expect(isDinStandard('iso10642')).toBe(false);
	});

	it('should return false for invalid IDs', () => {
		expect(isDinStandard('ansi123')).toBe(false);
		expect(isDinStandard('')).toBe(false);
	});
});
