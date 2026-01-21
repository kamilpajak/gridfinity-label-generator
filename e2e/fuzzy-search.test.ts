import { expect, test } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * Test cases for fuzzy search functionality
 * Each case defines: search term, expected keywords in results, and description
 */
const SEARCH_TEST_CASES = [
	// Partial word matching (autocomplete behavior)
	{
		search: 'hex n',
		expected: ['hexagon', 'nut'],
		description: 'partial "hex n" finds hexagon nut'
	},
	{
		search: 'hex nu',
		expected: ['hexagon', 'nut'],
		description: 'partial "hex nu" finds hexagon nut'
	},
	{
		search: 'socket h',
		expected: ['socket'],
		description: 'partial "socket h" finds socket head'
	},

	// Synonym/alias matching
	{
		search: 'hex nut',
		expected: ['hexagon'],
		description: '"hex nut" expands to hexagon'
	},
	{
		search: 'grub screw',
		expected: ['set screw'],
		description: '"grub screw" finds set screw'
	},
	{
		search: 'torx',
		expected: ['hexalobular'],
		description: '"torx" expands to hexalobular'
	},
	{
		search: 'allen',
		expected: ['socket'],
		description: '"allen" expands to socket'
	},
	{
		search: 'phillips',
		expected: ['cross-recessed', 'cross recessed'],
		description: '"phillips" expands to cross-recessed'
	},

	// Typo tolerance
	{
		search: 'hexagn',
		expected: ['hexagon'],
		description: 'typo "hexagn" finds hexagon'
	},
	{
		search: 'sockt',
		expected: ['socket'],
		description: 'typo "sockt" finds socket'
	},
	{
		search: 'philips',
		expected: ['cross-recessed', 'cross recessed'],
		description: 'typo "philips" finds cross-recessed'
	}
] as const;

test.describe('Fuzzy Search - Aliases', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
		await labelPage.selectMode('fastener');
	});

	for (const { search, expected, description } of SEARCH_TEST_CASES) {
		test(`should find results: ${description}`, async () => {
			// Open hardware search
			await labelPage.hardwareSelectButton.click();
			await labelPage.hardwareSearchInput.waitFor({ state: 'visible' });
			await labelPage.hardwareSearchInput.fill(search);

			// Wait for results
			const results = labelPage.hardwareSearchResults;
			await expect(results.first()).toBeVisible();

			// Verify expected keywords appear in results
			const resultTexts = await results.allTextContents();
			const hasExpectedResult = resultTexts.some((text) => {
				const lowerText = text.toLowerCase();
				// All expected keywords must be present (AND logic for arrays like ['hexagon', 'nut'])
				// OR any single keyword matches (for alternatives like ['cross-recessed', 'cross recessed'])
				if (expected.length === 2 && !expected[0].includes('-')) {
					// Two separate words that must both appear (e.g., hexagon + nut)
					return expected.every((keyword) => lowerText.includes(keyword));
				}
				// Single keyword or alternatives (any match is OK)
				return expected.some((keyword) => lowerText.includes(keyword));
			});

			expect(
				hasExpectedResult,
				`Expected search "${search}" to find results containing: ${expected.join(' or ')}`
			).toBe(true);
		});
	}
});
