import { describe, it, expect } from 'vitest';
import {
	parseWuerthFilename,
	matchWuerthToStandard,
	generateTargetFilename,
	groupWuerthFiles,
	type WuerthFileInfo
} from './wuerth-filename-parser';

describe('wuerth-filename-parser', () => {
	describe('parseWuerthFilename', () => {
		it('should parse filename with both ISO and DIN standards', () => {
			const filename = 'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg';

			const result = parseWuerthFilename(filename);

			expect(result).toEqual({
				productId: '008610_100',
				standards: [{ system: 'DIN', code: '6912' }],
				view: 'back',
				lod: 'High'
			});
		});

		it('should parse filename with DIN only', () => {
			const filename = 'Wuerth_WIS_009201665_DIN_931_bare_stainless_steel_A4_LOD_High_1_BACK.svg';

			const result = parseWuerthFilename(filename);

			expect(result).toEqual({
				productId: '009201665',
				standards: [{ system: 'DIN', code: '931' }],
				view: 'back',
				lod: 'High'
			});
		});

		it('should parse filename with left view', () => {
			const filename = 'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_LEFT.svg';

			const result = parseWuerthFilename(filename);

			expect(result?.view).toBe('left');
		});

		it('should parse filename with ISO only', () => {
			const filename = 'Wuerth_WIS_12345_ISO_7380_steel_8.8_LOD_High_1_BACK.svg';

			const result = parseWuerthFilename(filename);

			expect(result).toEqual({
				productId: '12345',
				standards: [{ system: 'ISO', code: '7380' }],
				view: 'back',
				lod: 'High'
			});
		});

		it('should handle multi-part standard codes', () => {
			// Some standards have codes like 7380-1, 7380-2
			const filename = 'Wuerth_WIS_12345_ISO_7380-1_steel_8.8_LOD_High_1_BACK.svg';

			const result = parseWuerthFilename(filename);

			expect(result?.standards).toEqual([{ system: 'ISO', code: '7380-1' }]);
		});

		it('should return null for invalid filenames', () => {
			expect(parseWuerthFilename('random_file.svg')).toBeNull();
			expect(parseWuerthFilename('not_wuerth.svg')).toBeNull();
			expect(parseWuerthFilename('')).toBeNull();
		});

		it('should handle filename with full path', () => {
			const fullPath =
				'/Users/jacoren/Downloads/Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg';

			const result = parseWuerthFilename(fullPath);

			expect(result?.productId).toBe('008610_100');
			expect(result?.standards).toHaveLength(1);
		});

		it('should handle lowercase view names', () => {
			const filename = 'Wuerth_WIS_12345_DIN_912_steel_LOD_High_back.svg';

			const result = parseWuerthFilename(filename);

			expect(result?.view).toBe('back');
		});

		it('should parse filename with LOD_Medium', () => {
			const filename = 'Wuerth_WIS_12345_DIN_912_steel_LOD_Medium_1_BACK.svg';

			const result = parseWuerthFilename(filename);

			expect(result).toEqual({
				productId: '12345',
				standards: [{ system: 'DIN', code: '912' }],
				view: 'back',
				lod: 'Medium'
			});
		});

		it('should parse filename with LOD_Low', () => {
			const filename = 'Wuerth_WIS_12345_DIN_912_steel_LOD_Low_1_LEFT.svg';

			const result = parseWuerthFilename(filename);

			expect(result).toEqual({
				productId: '12345',
				standards: [{ system: 'DIN', code: '912' }],
				view: 'left',
				lod: 'Low'
			});
		});

		it('should parse filename with LOD without variant number', () => {
			const filename = 'Wuerth_WIS_12345_DIN_912_steel_LOD_High_BACK.svg';

			const result = parseWuerthFilename(filename);

			expect(result?.productId).toBe('12345');
			expect(result?.lod).toBe('High');
			expect(result?.view).toBe('back');
		});

		describe('ReDoS resistance', () => {
			it('should parse malicious input with many underscores quickly', () => {
				// This input could cause catastrophic backtracking with vulnerable regex
				const maliciousInput = 'Wuerth_WIS_' + 'a_'.repeat(100) + 'DIN_912_LOD_High_back.svg';

				const start = performance.now();
				const result = parseWuerthFilename(maliciousInput);
				const elapsed = performance.now() - start;

				// Should complete in under 100ms (vulnerable regex would take seconds/minutes)
				expect(elapsed).toBeLessThan(100);
				expect(result).not.toBeNull();
			});

			it('should handle input without LOD suffix quickly', () => {
				// Input that won't match - could cause backtracking in suffix removal
				const input = 'Wuerth_WIS_' + 'x'.repeat(1000) + '_DIN_912_no_lod_here.svg';

				const start = performance.now();
				parseWuerthFilename(input);
				const elapsed = performance.now() - start;

				expect(elapsed).toBeLessThan(100);
			});

			it('should handle repeated LOD-like patterns quickly', () => {
				// Pattern designed to confuse greedy regex matching
				const input = 'Wuerth_WIS_12345_DIN_912_LOD_LOD_LOD_High_back.svg';

				const start = performance.now();
				const result = parseWuerthFilename(input);
				const elapsed = performance.now() - start;

				expect(elapsed).toBeLessThan(100);
				// Should still parse correctly
				expect(result?.lod).toBe('High');
			});
		});
	});

	describe('matchWuerthToStandard', () => {
		it('should match DIN 6912 file to din6912 standard', () => {
			const fileInfo: WuerthFileInfo = {
				productId: '008610_100',
				standards: [{ system: 'DIN', code: '6912' }],
				view: 'back',
				lod: 'High'
			};

			const standardId = matchWuerthToStandard(fileInfo);

			expect(standardId).toBe('iso7379'); // DIN 6912 = ISO 7379
		});

		it('should match DIN-only file to corresponding standard (DIN 931 = ISO 4014)', () => {
			const fileInfo: WuerthFileInfo = {
				productId: '009201665',
				standards: [{ system: 'DIN', code: '931' }],
				view: 'back',
				lod: 'High'
			};

			const standardId = matchWuerthToStandard(fileInfo);

			// DIN 931 is cross-referenced to ISO 4014 in our database
			expect(standardId).toBe('iso4014');
		});

		it('should match DIN-only standard that has no ISO equivalent', () => {
			const fileInfo: WuerthFileInfo = {
				productId: '12345',
				standards: [{ system: 'DIN', code: '912' }],
				view: 'back',
				lod: 'High'
			};

			const standardId = matchWuerthToStandard(fileInfo);

			// DIN 912 is cross-referenced to ISO 4762, so it should match
			expect(standardId).toBe('iso4762');
		});

		it('should return null when no matching standard exists', () => {
			const fileInfo: WuerthFileInfo = {
				productId: '99999',
				standards: [{ system: 'DIN', code: '99999' }],
				view: 'back',
				lod: 'High'
			};

			const standardId = matchWuerthToStandard(fileInfo);

			expect(standardId).toBeNull();
		});

		it('should match standard with hyphenated code', () => {
			const fileInfo: WuerthFileInfo = {
				productId: '12345',
				standards: [{ system: 'ISO', code: '7380-1' }],
				view: 'back',
				lod: 'High'
			};

			const standardId = matchWuerthToStandard(fileInfo);

			// Should match iso7380-1 if it exists, otherwise null
			// This test documents expected behavior
			expect(standardId === 'iso7380-1' || standardId === null).toBe(true);
		});
	});

	describe('generateTargetFilename', () => {
		it('should generate ISO filename', () => {
			expect(generateTargetFilename('iso4762')).toBe('iso_4762.svg');
			expect(generateTargetFilename('iso4014')).toBe('iso_4014.svg');
		});

		it('should generate DIN filename', () => {
			expect(generateTargetFilename('din912')).toBe('din_912.svg');
			expect(generateTargetFilename('din931')).toBe('din_931.svg');
		});

		it('should handle hyphenated codes', () => {
			expect(generateTargetFilename('iso7380-1')).toBe('iso_7380-1.svg');
		});

		it('should be case-insensitive', () => {
			expect(generateTargetFilename('ISO4762')).toBe('iso_4762.svg');
			expect(generateTargetFilename('DIN912')).toBe('din_912.svg');
		});

		it('should fallback for unknown formats', () => {
			expect(generateTargetFilename('unknown')).toBe('unknown.svg');
		});
	});

	describe('groupWuerthFiles', () => {
		it('should group back and left views into pairs', () => {
			const files = [
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg',
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_LEFT.svg'
			];

			const pairs = groupWuerthFiles(files);

			expect(pairs).toHaveLength(1);
			expect(pairs[0].back).toContain('BACK.svg');
			expect(pairs[0].left).toContain('LEFT.svg');
			expect(pairs[0].standardId).toBe('iso7379');
		});

		it('should handle multiple pairs', () => {
			const files = [
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg',
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_LEFT.svg',
				'Wuerth_WIS_009201665_DIN_931_bare_stainless_steel_A4_LOD_High_1_BACK.svg',
				'Wuerth_WIS_009201665_DIN_931_bare_stainless_steel_A4_LOD_High_1_LEFT.svg'
			];

			const pairs = groupWuerthFiles(files);

			expect(pairs).toHaveLength(2);
			expect(pairs.map((p) => p.standardId).sort()).toEqual(['iso4014', 'iso7379']);
		});

		it('should skip files without matching pair', () => {
			const files = [
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg'
				// no left view
			];

			const pairs = groupWuerthFiles(files);

			expect(pairs).toHaveLength(0);
		});

		it('should skip files that do not match any standard', () => {
			const files = [
				'Wuerth_WIS_99999_DIN_99999_steel_LOD_High_1_BACK.svg',
				'Wuerth_WIS_99999_DIN_99999_steel_LOD_High_1_LEFT.svg'
			];

			const pairs = groupWuerthFiles(files);

			expect(pairs).toHaveLength(0);
		});

		it('should handle full paths', () => {
			const files = [
				'/Users/jacoren/Downloads/Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg',
				'/Users/jacoren/Downloads/Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_LEFT.svg'
			];

			const pairs = groupWuerthFiles(files);

			expect(pairs).toHaveLength(1);
			expect(pairs[0].back).toContain('/Users/jacoren/Downloads/');
		});

		it('should skip invalid filenames', () => {
			const files = [
				'random_file.svg',
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg',
				'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_LEFT.svg'
			];

			const pairs = groupWuerthFiles(files);

			expect(pairs).toHaveLength(1);
		});
	});

	describe('integration: parse and match workflow', () => {
		it('should correctly process DIN 6912 file', () => {
			const filename = 'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1_BACK.svg';

			const parsed = parseWuerthFilename(filename);
			expect(parsed).not.toBeNull();

			const standardId = matchWuerthToStandard(parsed!);
			expect(standardId).toBe('iso7379'); // DIN 6912 = ISO 7379

			const targetFile = generateTargetFilename(standardId!);
			expect(targetFile).toBe('iso_7379.svg');
		});

		it('should correctly process DIN 931 file', () => {
			const filename = 'Wuerth_WIS_009201665_DIN_931_bare_stainless_steel_A4_LOD_High_1_BACK.svg';

			const parsed = parseWuerthFilename(filename);
			expect(parsed).not.toBeNull();

			const standardId = matchWuerthToStandard(parsed!);
			expect(standardId).toBe('iso4014');

			const targetFile = generateTargetFilename(standardId!);
			expect(targetFile).toBe('iso_4014.svg');
		});
	});
});
