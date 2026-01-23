/**
 * QR Code and Hardware Icon Mutual Exclusion Test
 *
 * Validates that QR Code and Hardware Icon cannot both be enabled
 * simultaneously on labels < 50mm width in both single and batch modes.
 *
 * This test ensures consistency between single mode and batch mode behavior.
 */

import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { setSliderValue } from './utils/slider-helpers';
import { LABEL_WIDTH_SLIDER_RANGE } from './types/page-objects';

test.describe('QR Code and Hardware Icon Mutual Exclusion', () => {
	test.describe('Single Mode', () => {
		let singlePage: SingleModePage;

		test.beforeEach(async ({ page }) => {
			singlePage = new SingleModePage(page);
			await singlePage.goto();
			// Select fastener mode
			await singlePage.selectMode('fastener');
			// Select a standard with hardware image
			await singlePage.selectHardwareByName('ISO', /ISO 4762/);
			// Set label width to 40mm (< 50mm threshold)
			await singlePage.setLabelWidth(40);
		});

		test('should disable QR Code when Hardware Icon is enabled on narrow label', async () => {
			// Enable Hardware Icon first
			if (!(await singlePage.isHardwareImageEnabled())) {
				await singlePage.toggleHardwareImage();
			}
			await expect(singlePage.hardwareImageSwitch).toBeChecked();

			// Try to enable QR Code
			if (!(await singlePage.isQRCodeEnabled())) {
				await singlePage.toggleQRCode();
			}

			// QR Code should be enabled, Hardware Icon should be disabled
			await expect(singlePage.qrCodeSwitch).toBeChecked();
			await expect(singlePage.hardwareImageSwitch).not.toBeChecked();
		});

		test('should disable Hardware Icon when QR Code is enabled on narrow label', async () => {
			// Enable QR Code first
			if (!(await singlePage.isQRCodeEnabled())) {
				await singlePage.toggleQRCode();
			}
			await expect(singlePage.qrCodeSwitch).toBeChecked();

			// Try to enable Hardware Icon
			if (!(await singlePage.isHardwareImageEnabled())) {
				await singlePage.toggleHardwareImage();
			}

			// Hardware Icon should be enabled, QR Code should be disabled
			await expect(singlePage.hardwareImageSwitch).toBeChecked();
			await expect(singlePage.qrCodeSwitch).not.toBeChecked();
		});

		test('should allow both features on wide label (≥50mm)', async () => {
			// Set label width to 50mm (at threshold)
			await singlePage.setLabelWidth(50);

			// Enable Hardware Icon
			if (!(await singlePage.isHardwareImageEnabled())) {
				await singlePage.toggleHardwareImage();
			}
			await expect(singlePage.hardwareImageSwitch).toBeChecked();

			// Enable QR Code
			if (!(await singlePage.isQRCodeEnabled())) {
				await singlePage.toggleQRCode();
			}
			await expect(singlePage.qrCodeSwitch).toBeChecked();

			// Both should remain enabled
			await expect(singlePage.hardwareImageSwitch).toBeChecked();
			await expect(singlePage.qrCodeSwitch).toBeChecked();
		});

		test('should disable QR Code when width reduced below 50mm with both enabled', async () => {
			// Start with width ≥50mm
			await singlePage.setLabelWidth(50);

			// Enable both
			if (!(await singlePage.isHardwareImageEnabled())) {
				await singlePage.toggleHardwareImage();
			}
			if (!(await singlePage.isQRCodeEnabled())) {
				await singlePage.toggleQRCode();
			}
			await expect(singlePage.hardwareImageSwitch).toBeChecked();
			await expect(singlePage.qrCodeSwitch).toBeChecked();

			// Reduce width below 50mm
			await singlePage.setLabelWidth(45);

			// QR Code should be disabled, Hardware Icon should remain
			await expect(singlePage.hardwareImageSwitch).toBeChecked();
			await expect(singlePage.qrCodeSwitch).not.toBeChecked();
		});
	});

	test.describe('Batch Mode', () => {
		let batchPage: BatchModePage;

		test.beforeEach(async ({ page }) => {
			batchPage = new BatchModePage(page);
			await batchPage.goto();
			// Select 12mm tape (QR enabled)
			await batchPage.selectTapeHeight('12mm');
		});

		test('should enforce mutual exclusion in batch label row', async ({ page }) => {
			// Add a label
			await batchPage.addLabel();
			await batchPage.waitForLabel(0);

			// Get elements for the first label
			const widthSlider = page.getByTestId('width-slider-0');
			const hardwareSwitch = page.getByTestId('hardware-image-switch-0');
			const qrSwitch = page.getByTestId('qr-code-switch-0');
			const standardSelect = page.getByTestId('batch-hardware-select-0');

			// Set width to 40mm (< 50mm) using click
			await setSliderValue(widthSlider, 40, LABEL_WIDTH_SLIDER_RANGE);

			// Select a standard with hardware image
			await standardSelect.click();
			await page
				.getByRole('option', { name: /ISO 4762/ })
				.first()
				.click();

			// Enable Hardware Icon first
			if (!(await hardwareSwitch.isChecked())) {
				await hardwareSwitch.click();
			}
			await expect(hardwareSwitch).toBeChecked();

			// Try to enable QR Code
			if (!(await qrSwitch.isChecked())) {
				await qrSwitch.click();
			}

			// QR Code should be enabled, Hardware Icon should be disabled
			await expect(qrSwitch).toBeChecked();
			await expect(hardwareSwitch).not.toBeChecked();
		});

		test('should allow both features on wide label in batch mode', async ({ page }) => {
			// Add a label
			await batchPage.addLabel();
			await batchPage.waitForLabel(0);

			// Get elements for the first label
			const widthSlider = page.getByTestId('width-slider-0');
			const hardwareSwitch = page.getByTestId('hardware-image-switch-0');
			const qrSwitch = page.getByTestId('qr-code-switch-0');
			const standardSelect = page.getByTestId('batch-hardware-select-0');

			// Set width to 50mm (at threshold) using click
			await setSliderValue(widthSlider, 50, LABEL_WIDTH_SLIDER_RANGE);

			// Select a standard with hardware image
			await standardSelect.click();
			await page
				.getByRole('option', { name: /ISO 4762/ })
				.first()
				.click();

			// Enable Hardware Icon
			if (!(await hardwareSwitch.isChecked())) {
				await hardwareSwitch.click();
			}
			await expect(hardwareSwitch).toBeChecked();

			// Enable QR Code
			if (!(await qrSwitch.isChecked())) {
				await qrSwitch.click();
			}
			await expect(qrSwitch).toBeChecked();

			// Both should remain enabled
			await expect(hardwareSwitch).toBeChecked();
			await expect(qrSwitch).toBeChecked();
		});

		test('should disable QR Code when width reduced in batch mode', async ({ page }) => {
			// Add a label
			await batchPage.addLabel();
			await batchPage.waitForLabel(0);

			// Get elements for the first label
			const widthSlider = page.getByTestId('width-slider-0');
			const hardwareSwitch = page.getByTestId('hardware-image-switch-0');
			const qrSwitch = page.getByTestId('qr-code-switch-0');
			const standardSelect = page.getByTestId('batch-hardware-select-0');

			// Start with width ≥50mm using click
			await setSliderValue(widthSlider, 50, LABEL_WIDTH_SLIDER_RANGE);

			// Select a standard with hardware image
			await standardSelect.click();
			await page
				.getByRole('option', { name: /ISO 4762/ })
				.first()
				.click();

			// Enable both
			if (!(await hardwareSwitch.isChecked())) {
				await hardwareSwitch.click();
			}
			if (!(await qrSwitch.isChecked())) {
				await qrSwitch.click();
			}
			await expect(hardwareSwitch).toBeChecked();
			await expect(qrSwitch).toBeChecked();

			// Reduce width below 50mm
			await setSliderValue(widthSlider, 45, LABEL_WIDTH_SLIDER_RANGE);

			// QR Code should be disabled, Hardware Icon should remain
			await expect(hardwareSwitch).toBeChecked();
			await expect(qrSwitch).not.toBeChecked();
		});
	});
});
