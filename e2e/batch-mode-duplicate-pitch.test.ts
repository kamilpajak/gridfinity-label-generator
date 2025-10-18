/**
 * Batch Mode Duplicate Pitch Bug Test
 *
 * Tests the bug where duplicating a label with a thread pitch set
 * results in the duplicated label losing the pitch value.
 *
 * Expected behavior:
 * - When duplicating a label with pitch set, the duplicate should preserve the pitch
 *
 * Scenario:
 * 1. Add label
 * 2. Select thread size (e.g., M8)
 * 3. Select thread pitch (e.g., 1.0mm)
 * 4. Duplicate the label
 * 5. Verify duplicated label has the same pitch value
 */

import { test, expect } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';

test.describe('Batch Mode - Duplicate Pitch Bug', () => {
	let batchPage: BatchModePage;

	test.beforeEach(async ({ page }) => {
		batchPage = new BatchModePage(page);
		await batchPage.goto();
		// Select 12mm tape
		await batchPage.selectTapeHeight('12mm');
	});

	test('should preserve thread pitch when duplicating label', async ({ page }) => {
		// Step 1: Add a label
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Step 2: Select thread size M8
		const labelRow0 = page.getByTestId('batch-label-row-0');
		const threadSizeTrigger0 = labelRow0.locator('button[id="thread-size-0"]');
		await threadSizeTrigger0.click();
		await page.getByRole('option', { name: 'M8' }).click();

		// Step 3: Select thread pitch 1.0mm (fine pitch)
		const pitchTrigger0 = labelRow0.locator('button[id="pitch-0"]');
		await expect(pitchTrigger0).toBeEnabled();
		await pitchTrigger0.click();
		await page.getByRole('option', { name: /1\.0/i }).first().click();

		// Verify pitch is set by checking the button text
		await expect(pitchTrigger0).toContainText('1.0');

		// Step 4: Duplicate the label
		await batchPage.duplicateLabel(0);
		await batchPage.waitForLabel(1);

		// Step 5: Verify duplicated label has the same pitch
		const labelRow1 = page.getByTestId('batch-label-row-1');
		const pitchTrigger1 = labelRow1.locator('button[id="pitch-1"]');

		// BUG: Pitch value should be preserved in duplicated label
		// Expected: "1.0mm Fine" or similar
		// Actual: "Select pitch..." (placeholder text)
		await expect(pitchTrigger1).toContainText('1.0');
	});
});
