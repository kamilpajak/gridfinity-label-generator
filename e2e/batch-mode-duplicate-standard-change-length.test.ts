/**
 * Batch Mode Duplicate + Standard Change Length Bug Test
 *
 * Tests the bug where duplicating a label with a screw (which has length),
 * then changing the duplicated label's standard to a washer (which shouldn't have length),
 * results in the washer label retaining the length value.
 *
 * Expected behavior:
 * - When changing from a hardware type that has length (screw/bolt/pin/rivet)
 *   to one that doesn't (washer/nut), the length field should be cleared
 *
 * Scenario:
 * 1. Add label with DIN 96 (screw)
 * 2. Enter length value (e.g., "20")
 * 3. Duplicate the label
 * 4. Change duplicated label's standard to DIN 127 (washer)
 * 5. Verify length field is cleared in the duplicated label
 */

import { test, expect } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';

test.describe('Batch Mode - Duplicate + Standard Change Length Bug', () => {
	let batchPage: BatchModePage;

	test.beforeEach(async ({ page }) => {
		batchPage = new BatchModePage(page);
		await batchPage.goto();
		// Select 12mm tape
		await batchPage.selectTapeHeight('12mm');
	});

	test('should clear length when changing from screw to washer after duplication', async ({
		page
	}) => {
		// Step 1: Add a label
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Step 2: Select DIN 96 (screw) standard
		// Find the standard combobox within the first label row
		const labelRow0 = page.getByTestId('batch-label-row-0');
		const standardButton0 = labelRow0.getByRole('combobox');
		await standardButton0.click();
		await page
			.getByRole('option', { name: /DIN 96/ })
			.first()
			.click();

		// Step 3: Enter length value
		const lengthInput0 = page.locator('input[id="length-0"]');
		await lengthInput0.waitFor({ state: 'visible' });
		await lengthInput0.fill('20');
		await expect(lengthInput0).toHaveValue('20');

		// Step 4: Duplicate the label
		await batchPage.duplicateLabel(0);
		await batchPage.waitForLabel(1);

		// Verify duplicated label has the same length
		const lengthInput1 = page.locator('input[id="length-1"]');
		await expect(lengthInput1).toBeVisible();
		await expect(lengthInput1).toHaveValue('20');

		// Step 5: Change duplicated label's standard to DIN 127 (washer)
		const labelRow1 = page.getByTestId('batch-label-row-1');
		const standardButton1 = labelRow1.getByRole('combobox');
		await standardButton1.click();

		const din127Option = page.getByRole('option', { name: /DIN 127/ }).first();
		await expect(din127Option).toBeVisible();
		await din127Option.click();

		// BUG: Length field should be cleared when changing to washer
		// Expected: length input should be empty
		// Actual: length input still contains "20"

		// Wait for the length to be cleared and input to be disabled
		await expect(lengthInput1).toBeDisabled();
		await expect(lengthInput1).toHaveValue('');
	});
});
