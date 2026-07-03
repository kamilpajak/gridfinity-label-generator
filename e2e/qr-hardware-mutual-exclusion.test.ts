/**
 * QR Code and Hardware Icon Mutual Exclusion Test
 *
 * Validates that QR Code and Hardware Icon cannot both be enabled
 * simultaneously on labels < 50mm width.
 *
 * Batch mode shares this same form, so covering it once in single mode is
 * sufficient (the batch form is literally the single-mode form).
 */

import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

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
});
