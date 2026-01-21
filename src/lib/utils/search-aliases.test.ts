import { describe, it, expect } from 'vitest';
import {
	findSynonymGroup,
	expandToken,
	tokenizeQuery,
	fuzzyMatchDescription
} from './search-aliases';

describe('Search Aliases', () => {
	describe('SYNONYM_GROUPS', () => {
		// Head shapes
		it('should have hex and hexagon in the same group', () => {
			const group = findSynonymGroup('hex');

			expect(group).toBeDefined();
			expect(group).toContain('hex');
			expect(group).toContain('hexagon');
			expect(group).toContain('hexagonal');
		});

		it('should have flat and countersunk in the same group', () => {
			const group = findSynonymGroup('flat');

			expect(group).toBeDefined();
			expect(group).toContain('countersunk');
		});

		it('should have cheese and cylinder head in the same group', () => {
			const group = findSynonymGroup('cheese');

			expect(group).toBeDefined();
			expect(group).toContain('cylinder head');
		});

		it('should have fillister and cheese in the same group (symmetric)', () => {
			const group = findSynonymGroup('fillister');

			expect(group).toBeDefined();
			expect(group).toContain('cheese');
			expect(group).toContain('fillister');
		});

		// Drive types
		it('should have torx and hexalobular in the same group', () => {
			const group = findSynonymGroup('torx');

			expect(group).toBeDefined();
			expect(group).toContain('hexalobular');
		});

		it('should have allen and socket in the same group', () => {
			const group = findSynonymGroup('allen');

			expect(group).toBeDefined();
			expect(group).toContain('socket');
		});

		it('should have phillips and cross-recessed in the same group', () => {
			const group = findSynonymGroup('phillips');

			expect(group).toBeDefined();
			expect(group).toContain('cross-recessed');
		});

		it('should have cross and cross-recessed in the same group', () => {
			const group = findSynonymGroup('cross');

			expect(group).toBeDefined();
			expect(group).toContain('cross-recessed');
		});

		it('should have slotted and slot drive in the same group', () => {
			const group = findSynonymGroup('slotted');

			expect(group).toBeDefined();
			expect(group).toContain('slot drive');
		});

		// Screw types
		it('should have grub and set screw in the same group', () => {
			const group = findSynonymGroup('grub');

			expect(group).toBeDefined();
			expect(group).toContain('set screw');
		});

		it('should have cap and socket head cap in the same group', () => {
			const group = findSynonymGroup('cap');

			expect(group).toBeDefined();
			expect(group).toContain('socket head cap');
		});

		it('should have cup point and set screw in the same group', () => {
			const group = findSynonymGroup('cup point');

			expect(group).toBeDefined();
			expect(group).toContain('set screw');
		});

		it('should have dog point and set screw in the same group', () => {
			const group = findSynonymGroup('dog point');

			expect(group).toBeDefined();
			expect(group).toContain('set screw');
		});

		it('should return undefined for unknown terms', () => {
			const group = findSynonymGroup('unknown-term-xyz');

			expect(group).toBeUndefined();
		});
	});

	describe('expandToken', () => {
		it('should return all synonyms from the group', () => {
			const expanded = expandToken('hex');

			expect(expanded).toContain('hex');
			expect(expanded).toContain('hexagon');
			expect(expanded).toContain('hexagonal');
		});

		it('should return only original token if no synonym group exists', () => {
			const expanded = expandToken('bolt');

			expect(expanded).toEqual(['bolt']);
		});

		it('should be case-insensitive', () => {
			const expanded = expandToken('HEX');

			expect(expanded).toContain('hex');
			expect(expanded).toContain('hexagon');
		});

		it('should expand multi-word synonyms', () => {
			const expanded = expandToken('cup point');

			expect(expanded).toContain('cup point');
			expect(expanded).toContain('set screw');
			expect(expanded).toContain('cup');
		});
	});

	describe('tokenizeQuery', () => {
		it('should split query into words', () => {
			const tokens = tokenizeQuery('hex nut');

			expect(tokens).toEqual(['hex', 'nut']);
		});

		it('should handle multiple spaces', () => {
			const tokens = tokenizeQuery('hex   nut');

			expect(tokens).toEqual(['hex', 'nut']);
		});

		it('should lowercase tokens', () => {
			const tokens = tokenizeQuery('HEX NUT');

			expect(tokens).toEqual(['hex', 'nut']);
		});

		it('should trim whitespace', () => {
			const tokens = tokenizeQuery('  hex nut  ');

			expect(tokens).toEqual(['hex', 'nut']);
		});

		// Multi-word alias tests (bug fix)
		it('should preserve multi-word alias "cup point" as single token', () => {
			const tokens = tokenizeQuery('cup point screw');

			expect(tokens).toContain('cup point');
			expect(tokens).toContain('screw');
			expect(tokens).not.toContain('cup');
			expect(tokens).not.toContain('point');
		});

		it('should preserve multi-word alias "dog point" as single token', () => {
			const tokens = tokenizeQuery('dog point');

			expect(tokens).toContain('dog point');
			expect(tokens).not.toContain('dog');
		});

		it('should handle multiple multi-word aliases in one query', () => {
			const tokens = tokenizeQuery('cup point and dog point');

			expect(tokens).toContain('cup point');
			expect(tokens).toContain('dog point');
			expect(tokens).toContain('and');
		});

		it('should handle repeated multi-word alias in one query', () => {
			const tokens = tokenizeQuery('cup point vs cup point');

			// Multi-word alias is deduplicated (added once) but both occurrences
			// are removed from the query to prevent splitting into 'cup' and 'point'
			expect(tokens).toContain('cup point');
			expect(tokens).toContain('vs');
			// Should NOT contain 'cup' or 'point' as separate tokens
			expect(tokens).not.toContain('cup');
			expect(tokens).not.toContain('point');
		});
	});

	describe('fuzzyMatchDescription', () => {
		// Original aliases
		it('should match "hex nut" to "Hexagon nut"', () => {
			const result = fuzzyMatchDescription('hex nut', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should match "grub screw" to "Set screw with flat point"', () => {
			const result = fuzzyMatchDescription('grub screw', 'Set screw with flat point');

			expect(result).toBe(true);
		});

		it('should match "torx" to "Hexalobular socket head"', () => {
			const result = fuzzyMatchDescription('torx', 'Hexalobular socket head cap screw');

			expect(result).toBe(true);
		});

		it('should match "allen" to "Socket head cap screw"', () => {
			const result = fuzzyMatchDescription('allen', 'Socket head cap screw');

			expect(result).toBe(true);
		});

		it('should match "socket cap" to "Socket head cap screw"', () => {
			const result = fuzzyMatchDescription('socket cap', 'Socket head cap screw');

			expect(result).toBe(true);
		});

		// New aliases from Perplexity verification
		it('should match "phillips" to "Cross-recessed pan head screw"', () => {
			const result = fuzzyMatchDescription('phillips', 'Cross-recessed pan head screw');

			expect(result).toBe(true);
		});

		it('should match "cross" to "Cross-recessed head"', () => {
			const result = fuzzyMatchDescription('cross', 'Cross-recessed pan head screw');

			expect(result).toBe(true);
		});

		it('should match "slotted" to "Slotted pan head screw"', () => {
			const result = fuzzyMatchDescription('slotted', 'Slot drive pan head screw');

			expect(result).toBe(true);
		});

		it('should match "cheese" to "Cylinder head screw"', () => {
			const result = fuzzyMatchDescription('cheese', 'Cylinder head slotted screw');

			expect(result).toBe(true);
		});

		it('should match "flat head" to "Countersunk head"', () => {
			const result = fuzzyMatchDescription('flat head', 'Countersunk flat head screw');

			expect(result).toBe(true);
		});

		// Multi-word alias tests (bug fix)
		it('should match "cup point" to "Set screw with cup point"', () => {
			const result = fuzzyMatchDescription('cup point', 'Set screw with cup point');

			expect(result).toBe(true);
		});

		it('should match "dog point" to "Set screw with dog point"', () => {
			const result = fuzzyMatchDescription('dog point', 'Set screw with dog point');

			expect(result).toBe(true);
		});

		it('should match "cup point screw" using alias expansion', () => {
			// 'cup point' alias expands to 'set screw', 'cup'
			const result = fuzzyMatchDescription('cup point screw', 'Set screw with cup point');

			expect(result).toBe(true);
		});

		// Symmetric alias tests (bi-directional lookup)
		it('should match "hexagon" to description containing "hex" (reverse lookup)', () => {
			// Searching canonical term should find alias matches
			const result = fuzzyMatchDescription('hexagon', 'Hex bolt with flange');

			expect(result).toBe(true);
		});

		it('should match "socket" to description containing "allen" (reverse lookup)', () => {
			const result = fuzzyMatchDescription('socket', 'Allen key required');

			expect(result).toBe(true);
		});

		it('should match "hexalobular" to description containing "torx" (reverse lookup)', () => {
			const result = fuzzyMatchDescription('hexalobular', 'Torx drive screw');

			expect(result).toBe(true);
		});

		it('should match "cheese" to "fillister head" (symmetric alias)', () => {
			// fillister -> cheese, so cheese should also find fillister
			const result = fuzzyMatchDescription('cheese', 'Fillister head screw');

			expect(result).toBe(true);
		});

		// Negative cases
		it('should NOT match unrelated terms', () => {
			const result = fuzzyMatchDescription('hex nut', 'Spring washer');

			expect(result).toBe(false);
		});

		it('should require ALL tokens to match', () => {
			// "hex washer" should not match "Hexagon nut" (no "washer")
			const result = fuzzyMatchDescription('hex washer', 'Hexagon nut');

			expect(result).toBe(false);
		});

		// Word boundary tests (prevent false positives)
		it('should NOT match "cap" in "capstan" (word boundary)', () => {
			const result = fuzzyMatchDescription('cap', 'Slotted capstan screws');

			expect(result).toBe(false);
		});

		// Prefix matching for last token (autocomplete behavior)
		it('should match "hex n" to "Hexagon nut" (prefix on last token)', () => {
			const result = fuzzyMatchDescription('hex n', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should match "hex nu" to "Hexagon nut" (prefix on last token)', () => {
			const result = fuzzyMatchDescription('hex nu', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should match "socket h" to "Socket head cap screw" (prefix on last token)', () => {
			const result = fuzzyMatchDescription('socket h', 'Socket head cap screw');

			expect(result).toBe(true);
		});

		it('should match "grub s" to "Set screw with flat point" (prefix + alias)', () => {
			const result = fuzzyMatchDescription('grub s', 'Set screw with flat point');

			expect(result).toBe(true);
		});

		it('should NOT match prefix in middle tokens', () => {
			// "h nut" should NOT match "Hexagon nut" - prefix only works on last token
			const result = fuzzyMatchDescription('h nut', 'Hexagon nut');

			expect(result).toBe(false);
		});

		// Typo tolerance tests
		it('should match "philips" to "Phillips" (single letter typo)', () => {
			const result = fuzzyMatchDescription('philips', 'Phillips head screw');

			expect(result).toBe(true);
		});

		it('should match "hexagn" to "Hexagon" (missing letter)', () => {
			const result = fuzzyMatchDescription('hexagn', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should match "sockt" to "Socket" (missing letter)', () => {
			const result = fuzzyMatchDescription('sockt', 'Socket head cap screw');

			expect(result).toBe(true);
		});

		it('should match "scerw" to "Screw" (transposed letters)', () => {
			const result = fuzzyMatchDescription('scerw', 'Set screw with flat point');

			expect(result).toBe(true);
		});

		it('should match "hexagoon" to "Hexagon" (extra letter)', () => {
			const result = fuzzyMatchDescription('hexagoon', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should prefer synonym match over typo match', () => {
			// "hex" should match via synonym expansion, not typo tolerance
			const result = fuzzyMatchDescription('hex', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should NOT match with too many typos (distance > 2)', () => {
			// "hxgn" is too far from "hexagon" (distance = 3)
			const result = fuzzyMatchDescription('hxgn', 'Hexagon nut');

			expect(result).toBe(false);
		});

		it('should use stricter threshold for short words', () => {
			// "nt" should NOT match "nut" even though distance is 1
			// because for very short input, we need higher precision
			const result = fuzzyMatchDescription('nt', 'Hexagon nut');

			expect(result).toBe(false);
		});

		it('should handle typo in multi-word query', () => {
			// "hexagn nut" - typo in first word
			const result = fuzzyMatchDescription('hexagn nut', 'Hexagon nut');

			expect(result).toBe(true);
		});

		it('should handle typo combined with synonym', () => {
			// "grb screw" - "grb" is typo for "grub", which is synonym for "set screw"
			const result = fuzzyMatchDescription('grb screw', 'Set screw with flat point');

			expect(result).toBe(true);
		});
	});
});
