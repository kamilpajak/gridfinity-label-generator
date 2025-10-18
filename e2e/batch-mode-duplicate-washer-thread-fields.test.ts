/**
 * Batch Mode Duplicate Screw→Washer Thread Fields Bug Test
 *
 * Tests the bug where duplicating a label with thread size and pitch set,
 * then changing the duplicated label's standard to a washer (which doesn't have threads),
 * results in the washer label retaining invalid thread size and pitch values.
 *
 * Expected behavior:
 * - When changing from a hardware type with threads (screw/bolt) to one without (washer/nut),
 *   the threadSize and pitch fields should be cleared
 *
 * Scenario:
 * 1. Add label with thread size M8 and pitch 1.0mm
 * 2. Duplicate the label
 * 3. Change duplicated label's standard to DIN 127 (washer)
 * 4. Verify thread size and pitch are cleared in the duplicated label
 */

import { test, expect } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';

test.describe('Batch Mode - Duplicate Screw→Washer Thread Fields Bug', () => {
	let batchPage: BatchModePage;

	test.beforeEach(async ({ page }) => {
		batchPage = new BatchModePage(page);
		await batchPage.goto();
		// Select 12mm tape
		await batchPage.selectTapeHeight('12mm');
	});

	test('should clear thread fields when changing from screw to washer after duplication', async ({
		page
	}) => {
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

		// Verify thread size and pitch are set
		await expect(threadSizeTrigger0).toContainText('M8');
		await expect(pitchTrigger0).toContainText('1.0');

		// Step 4: Duplicate the label
		await batchPage.duplicateLabel(0);
		await batchPage.waitForLabel(1);

		// Step 5: Change duplicated label's standard to DIN 127 (washer)
		const labelRow1 = page.getByTestId('batch-label-row-1');
		const standardButton1 = labelRow1.getByRole('combobox');
		await standardButton1.click();
		await page
			.getByRole('option', { name: /DIN 127/ })
			.first()
			.click();

		// Step 6: Verify thread size and pitch are cleared
		const threadSizeTrigger1 = labelRow1.locator('button[id="thread-size-1"]');
		const pitchTrigger1 = labelRow1.locator('button[id="pitch-1"]');

		// BUG: Thread fields should be cleared when changing to washer
		// Expected: threadSize = "Select size..." and pitch = "Select pitch..."
		// Actual: threadSize = "M8" and pitch = "1.0mm (fine)"

		await expect(threadSizeTrigger1).toContainText('Select size');
		await expect(pitchTrigger1).toContainText('Select pitch');
	});
});
