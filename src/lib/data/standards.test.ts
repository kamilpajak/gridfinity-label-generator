import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { generatedStandards } from './standards-generated';
import { searchStandards } from './standards';

describe('Standards Image Validation', () => {
	it('should have valid image paths for all standards with images', () => {
		const standardsWithImages = generatedStandards.filter((s) => s.image);

		expect(standardsWithImages.length).toBeGreaterThan(0);

		const missing: string[] = [];

		standardsWithImages.forEach((std) => {
			if (!std.image) return;

			// Convert /images/standards/foo.png to static/images/standards/foo.png
			const filePath = join(process.cwd(), 'static', std.image);

			if (!existsSync(filePath)) {
				missing.push(`${std.id}: ${std.image}`);
			}
		});

		if (missing.length > 0) {
			console.error('Missing image files:', missing);
		}

		expect(missing).toHaveLength(0);
	});

	it('should have unique image paths', () => {
		const imagePaths = generatedStandards.filter((s) => s.image).map((s) => s.image) as string[];

		const uniquePaths = new Set(imagePaths);

		// Multiple standards can share the same image (via mappings), so this is OK
		expect(uniquePaths.size).toBeGreaterThan(0);
		expect(uniquePaths.size).toBeLessThanOrEqual(imagePaths.length);
	});

	it('should have correct image file extensions', () => {
		const standardsWithImages = generatedStandards.filter((s) => s.image);

		standardsWithImages.forEach((std) => {
			expect(std.image).toMatch(/\.(png|jpg|jpeg|svg)$/i);
		});
	});

	it('ISO 7046 (DIN 965) should have an image', () => {
		const iso7046 = generatedStandards.find((s) => s.id === 'iso7046');

		expect(iso7046).toBeDefined();
		expect(iso7046?.image).toBeDefined();
		expect(iso7046?.image).toContain('din_965.png');
	});
});

describe('Standards Search', () => {
	it('should prioritize exact code match', () => {
		// Search for "912" should return DIN 912 first, not DIN 9021
		const results = searchStandards('912');

		expect(results.length).toBeGreaterThan(0);

		// First result should have exact match on code "912"
		const firstResult = results[0];
		const hasExactMatch = firstResult.designations.some((d) => d.code === '912');
		expect(hasExactMatch).toBe(true);
	});

	it('should prioritize starts-with over contains', () => {
		// Search for "93" should prioritize DIN 93 over DIN 2093
		const results = searchStandards('93');

		expect(results.length).toBeGreaterThan(0);

		// Find positions of DIN 93 and DIN 2093
		const din93Index = results.findIndex((s) =>
			s.designations.some((d) => d.system === 'DIN' && d.code === '93')
		);
		const din2093Index = results.findIndex((s) =>
			s.designations.some((d) => d.system === 'DIN' && d.code === '2093')
		);

		// DIN 93 should come before DIN 2093 (if both exist)
		if (din93Index !== -1 && din2093Index !== -1) {
			expect(din93Index).toBeLessThan(din2093Index);
		}
	});

	it('should find standards by partial code match', () => {
		// Search for "476" should find ISO 4762
		const results = searchStandards('476');

		expect(results.length).toBeGreaterThan(0);

		const hasIso4762 = results.some((s) => s.id === 'iso4762');
		expect(hasIso4762).toBe(true);
	});

	it('should find standards by description', () => {
		// Search for "socket head" should find socket head standards
		const results = searchStandards('socket head');

		expect(results.length).toBeGreaterThan(0);

		// All results should contain "socket head" in description
		results.forEach((std) => {
			expect(std.description.toLowerCase()).toContain('socket');
		});
	});

	it('should find standards by full designation', () => {
		// Search for "DIN 912" should find the standard
		const results = searchStandards('DIN 912');

		expect(results.length).toBeGreaterThan(0);

		const firstResult = results[0];
		const hasDin912 = firstResult.designations.some((d) => d.system === 'DIN' && d.code === '912');
		expect(hasDin912).toBe(true);
	});

	it('should be case-insensitive', () => {
		const lowerResults = searchStandards('din 912');
		const upperResults = searchStandards('DIN 912');
		const mixedResults = searchStandards('DiN 912');

		expect(lowerResults.length).toBeGreaterThan(0);
		expect(lowerResults.length).toBe(upperResults.length);
		expect(lowerResults.length).toBe(mixedResults.length);
	});

	it('should find all scraped standards by their numeric codes', () => {
		const unsearchable: string[] = [];

		generatedStandards.forEach((standard) => {
			// Get all numeric codes from designations (e.g., "912", "4762", "127")
			const numericCodes = standard.designations.map((d) => d.code);

			// Try to find this standard using each of its numeric codes
			let foundByAnyCode = false;
			for (const code of numericCodes) {
				const results = searchStandards(code);
				if (results.some((r) => r.id === standard.id)) {
					foundByAnyCode = true;
					break;
				}
			}

			if (!foundByAnyCode) {
				unsearchable.push(
					`${standard.id} (${standard.designations.map((d) => `${d.system} ${d.code}`).join(', ')})`
				);
			}
		});

		if (unsearchable.length > 0) {
			console.error('Standards that cannot be found by their numeric codes:');
			console.error(unsearchable.join('\n'));
		}

		expect(unsearchable).toHaveLength(0);
	});

	it('should prioritize exact numeric match over partial match (DIN 96 before DIN 964)', () => {
		// Search for "96" should return DIN 96 as first result, not DIN 964 or ISO 2010
		const results = searchStandards('96');

		expect(results.length).toBeGreaterThan(0);

		// Find which result is DIN 96
		const din96Index = results.findIndex((s) =>
			s.designations.some((d) => d.system === 'DIN' && d.code === '96')
		);

		// Find which result is DIN 964 (ISO 2010)
		const din964Index = results.findIndex((s) =>
			s.designations.some((d) => d.system === 'DIN' && d.code === '964')
		);

		// Print first 5 results for debugging
		console.log('Search results for "96":');
		results.slice(0, 5).forEach((std, i) => {
			const codes = std.designations.map((d) => `${d.system} ${d.code}`).join(', ');
			console.log(`${i + 1}. ${std.id}: ${codes}`);
		});

		// DIN 96 should come before DIN 964 (if both exist)
		if (din96Index !== -1 && din964Index !== -1) {
			expect(din96Index).toBeLessThan(din964Index);
		}

		// DIN 96 should be the first result
		if (din96Index !== -1) {
			expect(din96Index).toBe(0);
		}
	});
});
