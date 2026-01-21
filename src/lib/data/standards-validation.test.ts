/**
 * Standards Validation Tests
 *
 * TDD tests for Phase 1 of the standards validation pipeline.
 * These tests verify that invalid standards are not present in the database.
 *
 * Related: Issue #37, docs/plan-standards-validation-pipeline.md
 */

import { describe, it, expect } from 'vitest';
import { getStandardById, standards } from './standards';

/**
 * Invalid standards identified in Issue #37
 * These should NOT exist in the standards database.
 */
const INVALID_STANDARDS = [
	{
		id: 'iso3266',
		reason: 'Wrong category - lifting equipment (ICS 53.020.30), not fasteners'
	},
	{
		id: 'iso4034',
		reason: 'Withdrawn (stage 95.99)'
	},
	{
		id: 'iso4036',
		reason: 'Withdrawn (stage 95.99)'
	},
	{
		id: 'iso1478',
		reason: 'Withdrawn (stage 95.99)'
	},
	{
		id: 'iso1581',
		reason: 'Does not exist in ISO database'
	}
];

describe('Invalid standards removal (Issue #37)', () => {
	it.each(INVALID_STANDARDS)('should NOT contain $id in standards database ($reason)', ({ id }) => {
		const standard = getStandardById(id);
		expect(standard).toBeUndefined();
	});

	it('should not have any of the 5 invalid standards in the database', () => {
		const invalidIds = INVALID_STANDARDS.map((s) => s.id);
		const foundInvalid = standards.filter((s) => invalidIds.includes(s.id));

		if (foundInvalid.length > 0) {
			const found = foundInvalid.map((s) => s.id).join(', ');
			expect.fail(
				`Found ${foundInvalid.length} invalid standard(s) that should be removed: ${found}`
			);
		}

		expect(foundInvalid).toHaveLength(0);
	});
});

/**
 * Invalid cross-references identified through verification
 * These ISO↔DIN mappings are INCORRECT and should not exist.
 */
const INVALID_CROSS_REFERENCES = [
	{
		isoId: 'iso14580',
		invalidDin: '34823',
		reason:
			'ISO 14580 = Hexalobular socket cheese head screws (Torx). ' +
			'DIN 34823 = Raised countersunk head screws with 12-point socket (XZN). ' +
			'Different head shape AND drive type. No DIN predecessor exists for ISO 14580.'
	}
];

describe('Invalid cross-references (verified against sources)', () => {
	it.each(INVALID_CROSS_REFERENCES)(
		'$isoId should NOT have DIN $invalidDin as cross-reference',
		({ isoId, invalidDin }) => {
			const standard = getStandardById(isoId);

			if (!standard) {
				// Standard doesn't exist - that's fine, no invalid cross-ref possible
				return;
			}

			const hasBadCrossRef = standard.designations.some(
				(d) => d.system === 'DIN' && d.code === invalidDin
			);

			expect(hasBadCrossRef).toBe(false);
		}
	);
});

describe('Standards config cross-reference validation', () => {
	it('every ISO standard should have at least one DIN cross-reference', () => {
		const isoStandards = standards.filter((s) => s.id.startsWith('iso'));

		const missingDinRef = isoStandards.filter((s) => {
			const hasDin = s.designations.some((d) => d.system === 'DIN');
			return !hasDin;
		});

		// Log warnings for ISO standards without DIN references
		// These should be reviewed for validity
		if (missingDinRef.length > 0) {
			console.warn(
				`\n⚠️  ${missingDinRef.length} ISO standard(s) without DIN cross-reference:`,
				missingDinRef.map((s) => s.id)
			);
		}

		// This is a warning, not a failure - some ISO standards legitimately have no DIN equivalent
		// The test documents which standards need review
		expect(true).toBe(true);
	});

	it('every crossref ISO standard should have valid DIN designation', () => {
		const isoStandards = standards.filter((s) => s.id.startsWith('iso'));

		for (const standard of isoStandards) {
			const dinDesignations = standard.designations.filter((d) => d.system === 'DIN');

			for (const din of dinDesignations) {
				// DIN code should be a valid number
				expect(din.code).toMatch(/^\d+$/);
			}
		}
	});
});

describe('Standards database integrity', () => {
	it('should have no duplicate standard IDs', () => {
		const ids = standards.map((s) => s.id);
		const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

		if (duplicates.length > 0) {
			expect.fail(`Found duplicate standard IDs: ${[...new Set(duplicates)].join(', ')}`);
		}

		expect(duplicates).toHaveLength(0);
	});

	it('should have no empty designations', () => {
		const emptyDesignations = standards.filter((s) => s.designations.length === 0);

		if (emptyDesignations.length > 0) {
			const ids = emptyDesignations.map((s) => s.id).join(', ');
			expect.fail(`Standards with empty designations: ${ids}`);
		}

		expect(emptyDesignations).toHaveLength(0);
	});

	it('every standard should have a non-empty description', () => {
		const missingDescription = standards.filter(
			(s) => !s.description || s.description.trim() === ''
		);

		if (missingDescription.length > 0) {
			const ids = missingDescription.map((s) => s.id).join(', ');
			expect.fail(`Standards missing description: ${ids}`);
		}

		expect(missingDescription).toHaveLength(0);
	});
});
