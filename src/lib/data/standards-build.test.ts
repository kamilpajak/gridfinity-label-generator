/**
 * Standards Build Script Tests
 *
 * Tests scripts/standards-build.js helpers that decide the hardware type
 * written into standards-generated.ts.
 *
 * Regression context (discussion #112): when the maintainer-only DIN Media
 * cache is missing, descriptions fall back to plain "DIN <n>" and the
 * keyword heuristic resolves the hardware type to 'other'. The accurate
 * hardware type from data/image-mappings.json must still win, otherwise
 * nut/washer/ring standards wrongly require a length in the form.
 */

import { describe, it, expect } from 'vitest';
import { addImageToStandard } from '../../../scripts/standards-build.js';
import type { BuildStandard } from '../../../scripts/standards-build.js';

const DIN_315_DESIGNATIONS = [{ system: 'DIN', code: '315' }];

describe('addImageToStandard hardware type precedence', () => {
	it('overrides a heuristic hardware type with the image-mapping hardware type', () => {
		// Given: heuristic saw only "DIN 315" (no DIN Media cache) and returned 'other'
		const standard: BuildStandard = {
			id: 'din315',
			description: 'DIN 315',
			hardwareType: 'other'
		};
		const imageMappings = {
			din315: { image: '/images/standards/din_315.png', hardwareType: 'nut' }
		};

		// When
		addImageToStandard(standard, 'din315', imageMappings, DIN_315_DESIGNATIONS);

		// Then: the accurate mapping type wins over the heuristic
		expect(standard.hardwareType).toBe('nut');
		expect(standard.image).toBe('/images/standards/din_315.png');
	});

	it('applies the image-mapping hardware type when none is set', () => {
		const standard: BuildStandard = { id: 'din315', description: 'Wing nuts' };
		const imageMappings = {
			din315: { image: '/images/standards/din_315.png', hardwareType: 'nut' }
		};

		addImageToStandard(standard, 'din315', imageMappings, DIN_315_DESIGNATIONS);

		expect(standard.hardwareType).toBe('nut');
	});

	it('keeps the existing hardware type when the mapping has none', () => {
		const standard: BuildStandard = {
			id: 'din315',
			description: 'Wing nuts',
			hardwareType: 'nut'
		};
		const imageMappings = {
			din315: { image: '/images/standards/din_315.png' }
		};

		addImageToStandard(standard, 'din315', imageMappings, DIN_315_DESIGNATIONS);

		expect(standard.hardwareType).toBe('nut');
	});

	it('applies the image-mapping hardware type even when the mapping has no image', () => {
		const standard: BuildStandard = {
			id: 'din315',
			description: 'DIN 315',
			hardwareType: 'other'
		};
		const imageMappings = { din315: { hardwareType: 'nut' } };

		addImageToStandard(standard, 'din315', imageMappings, DIN_315_DESIGNATIONS);

		expect(standard.hardwareType).toBe('nut');
	});

	it('keeps the existing hardware type for old string-format mappings', () => {
		const standard: BuildStandard = {
			id: 'din315',
			description: 'Wing nuts',
			hardwareType: 'nut'
		};
		const imageMappings = { din315: '/images/standards/din_315.png' };

		addImageToStandard(standard, 'din315', imageMappings, DIN_315_DESIGNATIONS);

		expect(standard.hardwareType).toBe('nut');
		expect(standard.image).toBe('/images/standards/din_315.png');
	});
});
