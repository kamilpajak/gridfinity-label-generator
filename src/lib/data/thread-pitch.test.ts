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

/**
 * ST (Self-Tapping) sizes tests
 *
 * Self-tapping screws use dedicated ST sizes per ISO standards,
 * not the standard metric M-series.
 */
describe('ST (Self-Tapping) sizes', () => {
	describe('selfTappingSizes array', () => {
		it('should export selfTappingSizes array', async () => {
			const { selfTappingSizes } = await import('./thread-pitch');
			expect(selfTappingSizes).toBeDefined();
			expect(Array.isArray(selfTappingSizes)).toBe(true);
		});

		it('should contain all standard ST sizes in correct order', async () => {
			const { selfTappingSizes } = await import('./thread-pitch');
			const expectedSizes = [
				'ST2.2',
				'ST2.9',
				'ST3.5',
				'ST3.9',
				'ST4.2',
				'ST4.8',
				'ST5.5',
				'ST6.3'
			];
			expect(selfTappingSizes).toEqual(expectedSizes);
		});

		it('should include ST3.5 (standard ST size, unlike non-standard M3.5)', async () => {
			const { selfTappingSizes } = await import('./thread-pitch');
			expect(selfTappingSizes).toContain('ST3.5');
		});
	});

	describe('getThreadSizes function', () => {
		it('should return metric sizes for metric system with non-self-tapping type', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const sizes = getThreadSizes('metric', 'screw');
			expect(sizes).toContain('M3');
			expect(sizes).toContain('M4');
			expect(sizes).not.toContain('ST3.5');
		});

		it('should return imperial sizes for imperial system with non-self-tapping type', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const sizes = getThreadSizes('imperial', 'screw');
			expect(sizes).toContain('#4');
			expect(sizes).toContain('1/4″');
			expect(sizes).not.toContain('ST3.5');
		});

		it('should return ST sizes for self_tapping hardware type (metric)', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const sizes = getThreadSizes('metric', 'self_tapping');
			expect(sizes).toContain('ST2.2');
			expect(sizes).toContain('ST3.5');
			expect(sizes).toContain('ST6.3');
			expect(sizes).not.toContain('M3');
		});

		it('should return ST sizes for self_tapping hardware type (imperial)', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			// ST sizes are the same regardless of measurement system
			const sizes = getThreadSizes('imperial', 'self_tapping');
			expect(sizes).toContain('ST2.2');
			expect(sizes).toContain('ST3.5');
			expect(sizes).toContain('ST6.3');
			expect(sizes).not.toContain('#4');
		});

		it('should return metric sizes when hardwareType is undefined', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const sizes = getThreadSizes('metric', undefined);
			expect(sizes).toContain('M3');
			expect(sizes).not.toContain('ST3.5');
		});
	});
});

/**
 * ThreadSizeSystem tests
 *
 * Tests for the new thread size system architecture that supports
 * different size series: metric, imperial, st (sheet metal), wood
 */
describe('ThreadSizeSystem', () => {
	describe('woodScrewSizes array', () => {
		it('should export woodScrewSizes array', async () => {
			const { woodScrewSizes } = await import('./thread-pitch');
			expect(woodScrewSizes).toBeDefined();
			expect(Array.isArray(woodScrewSizes)).toBe(true);
		});

		it('should contain standard wood screw diameters', async () => {
			const { woodScrewSizes } = await import('./thread-pitch');
			// Common wood screw diameters in mm
			expect(woodScrewSizes).toContain('3');
			expect(woodScrewSizes).toContain('3.5');
			expect(woodScrewSizes).toContain('4');
			expect(woodScrewSizes).toContain('4.5');
			expect(woodScrewSizes).toContain('5');
			expect(woodScrewSizes).toContain('6');
		});

		it('should NOT have ST or M prefix (plain diameters)', async () => {
			const { woodScrewSizes } = await import('./thread-pitch');
			const hasPrefix = woodScrewSizes.some((s: string) => s.startsWith('ST') || s.startsWith('M'));
			expect(hasPrefix).toBe(false);
		});
	});

	describe('WOOD_SCREW_STANDARD_IDS constant', () => {
		it('should export WOOD_SCREW_STANDARD_IDS', async () => {
			const { WOOD_SCREW_STANDARD_IDS } = await import('./thread-pitch');
			expect(WOOD_SCREW_STANDARD_IDS).toBeDefined();
			expect(Array.isArray(WOOD_SCREW_STANDARD_IDS)).toBe(true);
		});

		it('should include known wood screw standards', async () => {
			const { WOOD_SCREW_STANDARD_IDS } = await import('./thread-pitch');
			expect(WOOD_SCREW_STANDARD_IDS).toContain('din571');
			expect(WOOD_SCREW_STANDARD_IDS).toContain('din7997');
			expect(WOOD_SCREW_STANDARD_IDS).toContain('din95');
			expect(WOOD_SCREW_STANDARD_IDS).toContain('din96');
			expect(WOOD_SCREW_STANDARD_IDS).toContain('din97');
		});
	});

	describe('getThreadSizeSystem function', () => {
		it('should return "nominal" for wood screw standards (DIN 571)', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			const mockStandard = { id: 'din571', hardwareType: 'self_tapping' };
			expect(getThreadSizeSystem(mockStandard, 'metric')).toBe('nominal');
		});

		it('should return "nominal" for DIN 7997 (wood screws)', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			const mockStandard = { id: 'din7997', hardwareType: 'self_tapping' };
			expect(getThreadSizeSystem(mockStandard, 'metric')).toBe('nominal');
		});

		it('should return "tapping" for sheet metal self-tapping (ISO 7049)', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			const mockStandard = { id: 'iso7049', hardwareType: 'self_tapping' };
			expect(getThreadSizeSystem(mockStandard, 'metric')).toBe('tapping');
		});

		it('should return "iso_metric" for regular metric screws', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			const mockStandard = { id: 'iso4762', hardwareType: 'screw' };
			expect(getThreadSizeSystem(mockStandard, 'metric')).toBe('iso_metric');
		});

		it('should return "uts" for imperial measurement system', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			const mockStandard = { id: 'iso4762', hardwareType: 'screw' };
			expect(getThreadSizeSystem(mockStandard, 'imperial')).toBe('uts');
		});

		it('should respect explicit threadSizeSystem override on standard', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			// Even though it's self_tapping, explicit override should win
			const mockStandard = {
				id: 'custom123',
				hardwareType: 'self_tapping',
				threadSizeSystem: 'iso_metric' as const
			};
			expect(getThreadSizeSystem(mockStandard, 'metric')).toBe('iso_metric');
		});

		it('should return measurement system when standard is undefined', async () => {
			const { getThreadSizeSystem } = await import('./thread-pitch');
			expect(getThreadSizeSystem(undefined, 'metric')).toBe('iso_metric');
			expect(getThreadSizeSystem(undefined, 'imperial')).toBe('uts');
		});
	});

	describe('getThreadSizes with ThreadSizeSystem', () => {
		it('should return wood sizes for wood screw standards', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const mockStandard = { id: 'din571', hardwareType: 'self_tapping' };
			const sizes = getThreadSizes('metric', mockStandard.hardwareType, mockStandard.id);
			expect(sizes).toContain('3');
			expect(sizes).toContain('4.5');
			expect(sizes).not.toContain('ST3.5');
			expect(sizes).not.toContain('M3');
		});

		it('should return ST sizes for sheet metal self-tapping', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const mockStandard = { id: 'iso7049', hardwareType: 'self_tapping' };
			const sizes = getThreadSizes('metric', mockStandard.hardwareType, mockStandard.id);
			expect(sizes).toContain('ST3.5');
			expect(sizes).not.toContain('3.5'); // plain diameter
		});

		it('should return metric sizes when standardId provided but hardwareType undefined', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			// Edge case: standardId without hardwareType - should use measurement system
			const sizes = getThreadSizes('metric', undefined, 'iso4762');
			expect(sizes).toContain('M3');
			expect(sizes).toContain('M5');
			expect(sizes).not.toContain('ST3.5');
		});

		it('should return imperial sizes when standardId provided but hardwareType undefined (imperial)', async () => {
			const { getThreadSizes } = await import('./thread-pitch');
			const sizes = getThreadSizes('imperial', undefined, 'iso4762');
			expect(sizes).toContain('#4');
			expect(sizes).toContain('1/4″');
			expect(sizes).not.toContain('M3');
		});
	});
});
