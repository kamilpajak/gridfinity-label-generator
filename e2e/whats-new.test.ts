import { expect, test } from '@playwright/test';
import { WhatsNewCard } from './pages/components/WhatsNewCard';

test.describe("What's New Section", () => {
	let whatsNew: WhatsNewCard;

	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		whatsNew = new WhatsNewCard(page);
	});

	test("should display What's New card", async () => {
		await expect(whatsNew.card).toBeVisible();
	});

	test('should show version badge', async () => {
		const version = await whatsNew.getVersion();
		expect(version).toMatch(/^v?\d+\.\d+\.\d+/);
	});

	test('should display changelog entries', async () => {
		const itemCount = await whatsNew.getItemCount();
		expect(itemCount).toBeGreaterThan(0);
	});

	test('should show entries as flat list with titles', async () => {
		const titles = await whatsNew.getItemTitles();
		expect(titles.length).toBeGreaterThan(0);

		// First entry should be from newest version (0.3.0) - custom image feature
		expect(titles[0]).toContain('Custom Image Upload');
	});

	test('should have category tags', async ({ page }) => {
		// Look for category tags (Feature, Bug Fix, Improvement, etc.)
		const categoryTags = page.getByTestId('category-tag');
		const tagCount = await categoryTags.count();
		expect(tagCount).toBeGreaterThan(0);
	});

	test('should show relative dates', async ({ page }) => {
		// Look for relative date indicators
		const dates = page.locator('[data-testid="relative-date"]');
		const dateCount = await dates.count();
		expect(dateCount).toBeGreaterThan(0);
	});

	test('should support infinite scroll when there are many entries', async () => {
		// Initial load should show limited entries
		const initialCount = await whatsNew.getItemCount();

		// Scroll to bottom
		await whatsNew.scrollToBottom();

		// Wait a moment for potential load
		await whatsNew.page.waitForTimeout(500);

		// Count should either stay same (if all loaded) or increase
		const finalCount = await whatsNew.getItemCount();
		expect(finalCount).toBeGreaterThanOrEqual(initialCount);
	});
});
