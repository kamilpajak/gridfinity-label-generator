/**
 * Tests for thread pitch data
 *
 * TDD: Testing support for #0 and #2 imperial sizes
 * These sizes are standard ANSI/ASME and commonly used in electronics
 */

import { describe, it, expect } from 'vitest';
import { imperialThreadPitches, getPitchOptions, hasPitchOptions } from './thread-pitch';

describe('Imperial Thread Sizes - #0 and #2 support', () => {
	describe('#0 size (smallest standard imperial)', () => {
		it('should have pitch options for #0', () => {
			expect(imperialThreadPitches['#0']).toBeDefined();
			expect(imperialThreadPitches['#0'].length).toBeGreaterThan(0);
		});

		it('should have UNC pitch for #0 (80 TPI)', () => {
			const uncOption = imperialThreadPitches['#0']?.find((p) => p.type === 'UNC');
			expect(uncOption).toBeDefined();
			expect(uncOption?.value).toBe('80');
		});

		it('should have UNF pitch for #0 (none - #0 has no standard UNF)', () => {
			// Note: #0 does not have a standard UNF pitch per ANSI/ASME
			// Only UNC (80 TPI) is standard for #0
			const options = imperialThreadPitches['#0'] || [];
			expect(options.length).toBe(1); // Only UNC
		});

		it('should return pitch options via getPitchOptions()', () => {
			const options = getPitchOptions('#0', 'imperial');
			expect(options.length).toBe(1);
			expect(options[0].type).toBe('UNC');
		});

		it('should report hasPitchOptions() = true', () => {
			expect(hasPitchOptions('#0', 'imperial')).toBe(true);
		});
	});

	describe('#2 size', () => {
		it('should have pitch options for #2', () => {
			expect(imperialThreadPitches['#2']).toBeDefined();
			expect(imperialThreadPitches['#2'].length).toBeGreaterThan(0);
		});

		it('should have UNC pitch for #2 (56 TPI)', () => {
			const uncOption = imperialThreadPitches['#2']?.find((p) => p.type === 'UNC');
			expect(uncOption).toBeDefined();
			expect(uncOption?.value).toBe('56');
		});

		it('should have UNF pitch for #2 (64 TPI)', () => {
			const unfOption = imperialThreadPitches['#2']?.find((p) => p.type === 'UNF');
			expect(unfOption).toBeDefined();
			expect(unfOption?.value).toBe('64');
		});

		it('should return pitch options via getPitchOptions()', () => {
			const options = getPitchOptions('#2', 'imperial');
			expect(options.length).toBe(2);
		});

		it('should report hasPitchOptions() = true', () => {
			expect(hasPitchOptions('#2', 'imperial')).toBe(true);
		});
	});

	describe('Size ordering (smallest to largest)', () => {
		it('should have sizes in ascending order: #0, #2, #4, #6...', () => {
			const sizes = Object.keys(imperialThreadPitches);
			const numberSizes = sizes.filter((s) => s.startsWith('#'));

			// Extract numbers and verify order
			const numbers = numberSizes.map((s) => parseInt(s.slice(1)));
			const sorted = [...numbers].sort((a, b) => a - b);

			expect(numbers).toEqual(sorted);
			expect(numbers[0]).toBe(0); // #0 is first
			expect(numbers[1]).toBe(2); // #2 is second
		});
	});
});

describe('Existing imperial sizes still work', () => {
	it.each(['#4', '#6', '#8', '#10', '1/4″', '5/16″', '3/8″', '1/2″', '5/8″'])(
		'should have pitch options for %s',
		(size) => {
			expect(hasPitchOptions(size, 'imperial')).toBe(true);
			expect(getPitchOptions(size, 'imperial').length).toBeGreaterThan(0);
		}
	);
});

describe('Metric sizes unaffected', () => {
	it.each(['M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10'])(
		'should have pitch options for %s',
		(size) => {
			expect(hasPitchOptions(size, 'metric')).toBe(true);
			expect(getPitchOptions(size, 'metric').length).toBeGreaterThan(0);
		}
	);
});
