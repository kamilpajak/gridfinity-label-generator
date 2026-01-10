import { describe, it, expect } from 'vitest';
import { extractStandardCode, getBaseName, groupFiles } from './svg-batch-utils';

describe('svg-batch-utils', () => {
	describe('extractStandardCode', () => {
		it('should extract DIN code', () => {
			const filename = 'Wuerth_WIS_008610_100_DIN_6912_steel_08.8_zinc_plated_LOD_High_1';
			expect(extractStandardCode(filename)).toBe('din_6912');
		});

		it('should extract ISO code', () => {
			const filename = 'Wuerth_WIS_12345_ISO_4762_steel_LOD_High';
			expect(extractStandardCode(filename)).toBe('iso_4762');
		});

		it('should prefer ISO over DIN when both present', () => {
			const filename = 'Wuerth_WIS_01088__25_ISO_4762DIN_912_steel';
			expect(extractStandardCode(filename)).toBe('iso_4762');
		});

		it('should handle hyphenated codes', () => {
			const filename = 'Wuerth_WIS_12345_ISO_7380-1_steel';
			expect(extractStandardCode(filename)).toBe('iso_7380-1');
		});

		it('should return null for unknown format', () => {
			expect(extractStandardCode('random_file')).toBeNull();
			expect(extractStandardCode('no_standard_here')).toBeNull();
		});

		it('should be case-insensitive', () => {
			expect(extractStandardCode('test_din_912_file')).toBe('din_912');
			expect(extractStandardCode('test_DIN_912_file')).toBe('din_912');
		});
	});

	describe('getBaseName', () => {
		it('should remove _BACK.svg suffix', () => {
			const filename = 'Wuerth_WIS_008610_100_DIN_6912_steel_LOD_High_1_BACK.svg';
			expect(getBaseName(filename)).toBe('Wuerth_WIS_008610_100_DIN_6912_steel_LOD_High_1');
		});

		it('should remove _LEFT.svg suffix', () => {
			const filename = 'Wuerth_WIS_008610_100_DIN_6912_steel_LOD_High_1_LEFT.svg';
			expect(getBaseName(filename)).toBe('Wuerth_WIS_008610_100_DIN_6912_steel_LOD_High_1');
		});

		it('should be case-insensitive', () => {
			expect(getBaseName('test_back.svg')).toBe('test');
			expect(getBaseName('test_BACK.svg')).toBe('test');
			expect(getBaseName('test_Back.svg')).toBe('test');
		});

		it('should not modify filenames without BACK/LEFT suffix', () => {
			const filename = 'other_file.svg';
			expect(getBaseName(filename)).toBe('other_file.svg');
		});
	});

	describe('groupFiles', () => {
		it('should group matching back and left files', () => {
			const files = [
				'Wuerth_WIS_008610_100_DIN_6912_steel_LOD_High_1_BACK.svg',
				'Wuerth_WIS_008610_100_DIN_6912_steel_LOD_High_1_LEFT.svg'
			];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(1);
			expect(pairs[0].back).toContain('BACK.svg');
			expect(pairs[0].left).toContain('LEFT.svg');
			expect(pairs[0].outputName).toBe('din_6912.svg');
		});

		it('should handle multiple pairs', () => {
			const files = [
				'Wuerth_WIS_001_DIN_6912_LOD_High_BACK.svg',
				'Wuerth_WIS_001_DIN_6912_LOD_High_LEFT.svg',
				'Wuerth_WIS_002_DIN_931_LOD_High_BACK.svg',
				'Wuerth_WIS_002_DIN_931_LOD_High_LEFT.svg'
			];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(2);
			expect(pairs.map((p) => p.outputName).sort()).toEqual(['din_6912.svg', 'din_931.svg']);
		});

		it('should skip incomplete pairs (only back)', () => {
			const files = ['Wuerth_WIS_001_DIN_6912_LOD_High_BACK.svg'];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(0);
		});

		it('should skip incomplete pairs (only left)', () => {
			const files = ['Wuerth_WIS_001_DIN_6912_LOD_High_LEFT.svg'];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(0);
		});

		it('should skip files without BACK/LEFT suffix', () => {
			const files = [
				'random_file.svg',
				'Wuerth_WIS_001_DIN_6912_LOD_High_BACK.svg',
				'Wuerth_WIS_001_DIN_6912_LOD_High_LEFT.svg',
				'another_random.svg'
			];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(1);
		});

		it('should skip pairs without extractable standard code', () => {
			const files = ['unknown_format_BACK.svg', 'unknown_format_LEFT.svg'];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(0);
		});

		it('should handle ISO standards', () => {
			const files = [
				'Wuerth_WIS_001_ISO_4762_steel_BACK.svg',
				'Wuerth_WIS_001_ISO_4762_steel_LEFT.svg'
			];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(1);
			expect(pairs[0].outputName).toBe('iso_4762.svg');
		});

		it('should handle mixed case suffixes', () => {
			const files = ['Wuerth_WIS_001_DIN_6912_back.svg', 'Wuerth_WIS_001_DIN_6912_LEFT.svg'];

			const pairs = groupFiles(files);

			expect(pairs).toHaveLength(1);
		});
	});
});
