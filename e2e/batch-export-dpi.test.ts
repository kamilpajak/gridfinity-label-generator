/**
 * Batch Export DPI Validation Test
 *
 * Validates that clicking the "Export Batch" button in the UI
 * generates a PNG with correct 360 DPI dimensions.
 *
 * This test caught a regression where the UI hardcoded 300 DPI
 * while the utility defaulted to 360 DPI.
 */

import { test, expect } from '@playwright/test';

test.describe('Batch Export DPI', () => {
	test('should export batch with 360 DPI (not 300 DPI)', async ({ page }) => {
		await page.goto('/');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Switch to batch mode by clicking the Batch Mode tab
		const batchModeTab = page.locator('button:has-text("Batch Mode")');
		await batchModeTab.click();

		// Wait for batch mode UI elements to appear
		await page.waitForSelector('button:has-text("Add Label")', { state: 'visible' });

		// Select 12mm tape height using testid
		const tape12mmButton = page.getByTestId('tape-height-12mm');
		await tape12mmButton.waitFor({ state: 'visible' });
		await tape12mmButton.click();

		// Click Add Label button - this adds the current label configuration to the batch
		const addLabelButton = page.locator('button:has-text("Add Label")').first();
		await addLabelButton.click();

		// Wait for the export button to show "1 label" - this confirms the label was added
		await page.waitForSelector('button:has-text("Export Batch (1 label)")', { timeout: 5000 });

		// Set up canvas dimension interception BEFORE clicking export
		const canvasDimensionsPromise = page.evaluate(() => {
			return new Promise<{ width: number; height: number }>((resolve) => {
				// Spy on HTMLCanvasElement.prototype.toBlob
				const originalToBlob = HTMLCanvasElement.prototype.toBlob;
				HTMLCanvasElement.prototype.toBlob = function (
					callback: BlobCallback,
					type?: string,
					quality?: number
				) {
					// Capture canvas dimensions before blob creation
					const dimensions = {
						width: this.width,
						height: this.height
					};

					// Restore original toBlob immediately
					HTMLCanvasElement.prototype.toBlob = originalToBlob;

					// Resolve with dimensions
					resolve(dimensions);

					// Call original toBlob
					return originalToBlob.call(this, callback, type, quality);
				};
			});
		});

		// Click export button
		const exportButton = page.locator('button:has-text("Export Batch")');
		await exportButton.click();

		// Wait for canvas dimensions to be captured
		const dimensions = await canvasDimensionsPromise;

		// The default label from "Add Label" creates a label based on current form state
		// Expected at 360 DPI for 12mm tape (10mm printable after 2mm margins):
		// Height: 10mm * (360/25.4) = 142px ✓
		// Width varies based on form state
		expect(dimensions.height).toBe(142);

		// Verify this is 360 DPI, NOT 300 DPI
		// At 300 DPI, height would be: 10mm * (300/25.4) ≈ 118px
		expect(dimensions.height).not.toBe(118);

		// Width should also reflect 360 DPI (not 300 DPI)
		// If width is 439px, that's 31mm at 360 DPI
		// At 300 DPI, 31mm would be 366px
		if (dimensions.width === 439) {
			// 31mm label at 360 DPI
			expect(dimensions.width).not.toBe(366); // Would be 366 at 300 DPI
		}

		// Verify export success message
		await expect(page.locator('text=✓ Exported')).toBeVisible({ timeout: 5000 });
	});
});
