/**
 * Standards Configuration Tests
 *
 * Validates that standards have correct metadata (hardwareType, descriptions)
 */

import { describe, it, expect } from 'vitest';
import { getStandardById, searchStandards, standards, HardwareType } from './standards';

const VALID_HARDWARE_TYPES = Object.values(HardwareType);

describe('All standards validation', () => {
	it('every standard should have a hardwareType assigned', () => {
		const missingHardwareType = standards.filter((s) => !s.hardwareType);

		if (missingHardwareType.length > 0) {
			const ids = missingHardwareType.map((s) => s.id).join(', ');
			expect.fail(`Standards missing hardwareType: ${ids}`);
		}

		expect(missingHardwareType).toHaveLength(0);
	});

	it('every standard should have a valid hardwareType value', () => {
		const invalidHardwareType = standards.filter(
			(s) => s.hardwareType && !VALID_HARDWARE_TYPES.includes(s.hardwareType)
		);

		if (invalidHardwareType.length > 0) {
			const details = invalidHardwareType.map((s) => `${s.id}: "${s.hardwareType}"`).join(', ');
			expect.fail(`Standards with invalid hardwareType: ${details}`);
		}

		expect(invalidHardwareType).toHaveLength(0);
	});
});

describe('DIN 7997 - Self-tapping screw classification', () => {
	it('should exist in standards database', () => {
		const standard = getStandardById('din7997');
		expect(standard).toBeDefined();
	});

	it('should have hardwareType "self_tapping"', () => {
		const standard = getStandardById('din7997');
		expect(standard?.hardwareType).toBe('self_tapping');
	});

	it('should have description mentioning wood screw', () => {
		const standard = getStandardById('din7997');
		expect(standard?.description.toLowerCase()).toMatch(/wood.screw/i);
	});

	it('should be a DIN-only standard (not ISO 14584)', () => {
		const standard = getStandardById('din7997');
		expect(standard?.primarySystem).toBe('DIN');
		// Should NOT have ISO designation (ISO 14584 is a different product)
		const isoDesignation = standard?.designations.find((d) => d.system === 'ISO');
		expect(isoDesignation).toBeUndefined();
	});
});

describe('DIN 6916 vs DIN 916 distinction', () => {
	describe('DIN 6916 - HV Washer for structural bolting', () => {
		it('should exist in standards database', () => {
			const standard = getStandardById('din6916');
			expect(standard).toBeDefined();
		});

		it('should have hardwareType "washer"', () => {
			const standard = getStandardById('din6916');
			expect(standard?.hardwareType).toBe('washer');
		});

		it('should have description mentioning washer', () => {
			const standard = getStandardById('din6916');
			expect(standard?.description.toLowerCase()).toMatch(/washer|podkładka/i);
		});

		it('should be searchable by "DIN 6916"', () => {
			const results = searchStandards('DIN 6916');
			const din6916 = results.find((s) => s.id === 'din6916');
			expect(din6916).toBeDefined();
		});

		// Note: ISO 7416 is withdrawn (replaced by ISO 14399-6)
		// DIN 6916 is now a DIN-only standard without ISO equivalent
		it('should be a DIN-only standard', () => {
			const standard = getStandardById('din6916');
			expect(standard?.primarySystem).toBe('DIN');
			// Should only have DIN designation (no ISO equivalent in our DB)
			const dinDesignation = standard?.designations.find((d) => d.system === 'DIN');
			expect(dinDesignation?.code).toBe('6916');
		});
	});

	describe('DIN 916 vs DIN 6916 distinction', () => {
		// Note: ISO 4029 (DIN 916 equivalent) has been replaced by newer standards
		// and is not in our database. This test ensures we don't confuse
		// DIN 916 searches with DIN 6916.

		it('should NOT confuse DIN 916 search with DIN 6916', () => {
			const din916Results = searchStandards('DIN 916');
			const din6916Results = searchStandards('DIN 6916');

			// DIN 6916 search should return the washer
			const din6916 = din6916Results.find((s) => s.id === 'din6916');
			expect(din6916?.hardwareType).toBe('washer');

			// DIN 916 search should NOT return DIN 6916 washer as a result
			// (search is for exact "916", not "6916")
			const din6916InResults = din916Results.find((s) => s.id === 'din6916');
			expect(din6916InResults).toBeUndefined();
		});
	});
});
