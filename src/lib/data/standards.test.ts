import { describe, it, expect } from 'vitest';
import { formatDesignations, formatPrimaryDesignation, type ISODINStandard } from './standards';

describe('Standards formatting functions', () => {
	describe('formatDesignations', () => {
		it('should format all designations with slashes', () => {
			const standard: ISODINStandard = {
				id: 'test1',
				primarySystem: 'ISO',
				description: 'Test standard',
				designations: [
					{ system: 'ISO', code: '4762' },
					{ system: 'DIN', code: '912' },
					{ system: 'ANSI', code: 'B18.3' }
				]
			};

			expect(formatDesignations(standard)).toBe('ISO 4762 / DIN 912 / ANSI B18.3');
		});

		it('should handle single designation', () => {
			const standard: ISODINStandard = {
				id: 'test2',
				primarySystem: 'DIN',
				description: 'Test standard',
				designations: [{ system: 'DIN', code: '934' }]
			};

			expect(formatDesignations(standard)).toBe('DIN 934');
		});

		it('should handle empty designations array', () => {
			const standard: ISODINStandard = {
				id: 'test3',
				primarySystem: 'ISO',
				description: 'Test standard',
				designations: []
			};

			expect(formatDesignations(standard)).toBe('');
		});
	});

	describe('formatPrimaryDesignation', () => {
		it('should return only the primary system designation', () => {
			const standard: ISODINStandard = {
				id: 'test1',
				primarySystem: 'ISO',
				description: 'Test standard',
				designations: [
					{ system: 'ISO', code: '4762' },
					{ system: 'DIN', code: '912' },
					{ system: 'ANSI', code: 'B18.3' }
				]
			};

			expect(formatPrimaryDesignation(standard)).toBe('ISO 4762');
		});

		it('should return DIN when primarySystem is DIN', () => {
			const standard: ISODINStandard = {
				id: 'test2',
				primarySystem: 'DIN',
				description: 'Test standard',
				designations: [
					{ system: 'ISO', code: '4762' },
					{ system: 'DIN', code: '912' }
				]
			};

			expect(formatPrimaryDesignation(standard)).toBe('DIN 912');
		});

		it('should fallback to first designation if primary not found', () => {
			const standard: ISODINStandard = {
				id: 'test3',
				primarySystem: 'ISO',
				description: 'Test standard',
				designations: [
					{ system: 'DIN', code: '912' },
					{ system: 'ANSI', code: 'B18.3' }
				]
			};

			expect(formatPrimaryDesignation(standard)).toBe('DIN 912');
		});

		it('should handle empty designations array', () => {
			const standard: ISODINStandard = {
				id: 'test4',
				primarySystem: 'ISO',
				description: 'Test standard',
				designations: []
			};

			expect(formatPrimaryDesignation(standard)).toBe('');
		});

		it('should handle single designation matching primary system', () => {
			const standard: ISODINStandard = {
				id: 'test5',
				primarySystem: 'DIN',
				description: 'Test standard',
				designations: [{ system: 'DIN', code: '934' }]
			};

			expect(formatPrimaryDesignation(standard)).toBe('DIN 934');
		});

		it('should handle primary system not in designations list', () => {
			const standard: ISODINStandard = {
				id: 'test6',
				primarySystem: 'ISO',
				description: 'Test standard',
				designations: [
					{ system: 'ANSI', code: 'B18.3' },
					{ system: 'JIS', code: 'B1176' }
				]
			};

			// Should fallback to first available
			expect(formatPrimaryDesignation(standard)).toBe('ANSI B18.3');
		});
	});
});