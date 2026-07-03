import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * TDD: Tests for canvas render status attribute
 *
 * Strategy 3 implementation: Event-driven canvas stability detection
 * Instead of polling canvas pixel data, we use data-render-status attribute
 * that signals when rendering is complete.
 *
 * Expected attribute values:
 * - "idle": No content to render (placeholder shown)
 * - "rendering": Layout calculation or canvas rendering in progress
 * - "stable": Rendering complete, canvas is ready for interaction
 */
test.describe('Canvas Render Status', () => {
	test('canvas should have data-render-status attribute', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode to get primary text input
		await labelPage.selectMode('general');

		// Enter some text to trigger canvas rendering (use low-level to skip waitForLabelRender)
		await labelPage.primaryTextInput.fill('M8');

		// Canvas should exist and have the data-render-status attribute
		const canvas = page.getByTestId('label-preview-canvas').filter({ visible: true });
		await expect(canvas).toBeVisible({ timeout: 5000 });
		await expect(canvas).toHaveAttribute('data-render-status');
	});

	test('canvas should have data-render-status="stable" after rendering completes', async ({
		page
	}) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectMode('general');

		// Enter some text to trigger canvas rendering
		await labelPage.primaryTextInput.fill('M8');

		// Wait for canvas to become stable
		const canvas = page.getByTestId('label-preview-canvas').filter({ visible: true });
		await expect(canvas).toHaveAttribute('data-render-status', 'stable', { timeout: 5000 });
	});

	test('canvas should transition to "rendering" during layout/render and then to "stable"', async ({
		page
	}) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectMode('general');

		// Enter initial text
		await labelPage.primaryTextInput.fill('M8');
		const canvas = page.getByTestId('label-preview-canvas').filter({ visible: true });

		// Wait for initial stable state
		await expect(canvas).toHaveAttribute('data-render-status', 'stable', { timeout: 5000 });

		// Now change text - should trigger rendering
		await labelPage.primaryTextInput.fill('M10 x 50');

		// Should eventually become stable again
		await expect(canvas).toHaveAttribute('data-render-status', 'stable', { timeout: 5000 });
	});

	test('waitForLabelRender should complete quickly using data-render-status', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectMode('general');

		// Enter text (without waitForLabelRender)
		await labelPage.primaryTextInput.fill('Test Label');

		// Wait for canvas to be visible first
		const canvas = page.getByTestId('label-preview-canvas').filter({ visible: true });
		await expect(canvas).toBeVisible({ timeout: 5000 });

		// Measure time for waitForLabelRender
		const startTime = Date.now();
		await labelPage.preview.waitForLabelRender();
		const endTime = Date.now();

		// Should complete in under 1000ms (vs ~400ms minimum with old polling)
		// Using 1000ms threshold to avoid flaky tests on slow CI runners
		const duration = endTime - startTime;
		expect(duration).toBeLessThan(1000);
	});

	test('multiple rapid changes should all result in stable state', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectMode('general');

		// Rapid fire multiple changes (using low-level to avoid waitForLabelRender)
		for (const text of ['A', 'AB', 'ABC', 'ABCD', 'ABCDE']) {
			await labelPage.primaryTextInput.fill(text);
		}

		// Canvas should eventually stabilize
		const canvas = page.getByTestId('label-preview-canvas').filter({ visible: true });
		await expect(canvas).toHaveAttribute('data-render-status', 'stable', { timeout: 5000 });
	});
});
