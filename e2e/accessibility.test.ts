import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Accessibility', () => {
	test('setting switches expose accessible names', async ({ page }) => {
		await page.goto('/');
		// role=switch + name comes from aria-label forwarded to the control.
		await expect(page.getByRole('switch', { name: 'ISO/DIN Standard' })).toHaveCount(1);
		await expect(page.getByRole('switch', { name: 'Hardware Icon' })).toHaveCount(1);
		await expect(page.getByRole('switch', { name: 'QR Code' })).toHaveCount(1);
	});

	test('batch reorderable rows have accessible names', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);
		await form.selectMode('general');
		await form.fillPrimaryText('Widget');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		const aria = await page.getByTestId('batch-label-row-0').getAttribute('aria-label');
		expect(aria).toBeTruthy();
		expect(aria).toContain('Widget');
	});

	test('honors prefers-reduced-motion', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');

		// An element that carries transition utilities should have its transition
		// neutralized to ~0 under reduced motion (vs the default ~150ms).
		const duration = await page
			.getByTestId('whats-new-button')
			.evaluate((el) => getComputedStyle(el).transitionDuration);
		expect(parseFloat(duration)).toBeLessThan(0.02);
	});
});
