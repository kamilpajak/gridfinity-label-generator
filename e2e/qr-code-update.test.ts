import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import { waitForQRCodeRender } from './utils/wait-helpers';

test.describe('QR Code Updates', () => {
	test('QR code visual should update when URL changes', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectLabelMode('General Item');

		// Add some text to show label
		await labelPage.fillPrimaryText('Test Label');

		// Enable QR code
		await labelPage.toggleQRCode();
		await labelPage.preview.waitForReady();

		// Enter first URL
		const firstUrl = 'https://example.com/first';
		await labelPage.fillQRCodeUrl(firstUrl);
		await labelPage.preview.waitForLabelRender();
		await waitForQRCodeRender(page);

		// Get QR code area pixels from first render
		const firstQrPixels = await labelPage.preview.getQRCodePixels();

		// Change to a different URL
		const secondUrl = 'https://example.com/second/different/url';

		await labelPage.fillQRCodeUrl(secondUrl);
		await labelPage.preview.waitForLabelRender();

		// Wait for QR code to render with new content
		await waitForQRCodeRender(page);

		// Get QR code area pixels from second render
		const secondQrPixels = await labelPage.preview.getQRCodePixels();

		// Verify canvas dimensions stayed the same
		expect(secondQrPixels.canvasWidth).toBe(firstQrPixels.canvasWidth);
		expect(secondQrPixels.canvasHeight).toBe(firstQrPixels.canvasHeight);

		// Compare pixels - they should be different for different QR codes
		const percentDifferent = labelPage.preview.compareQRCodePixels(
			firstQrPixels.pixels,
			secondQrPixels.pixels
		);

		console.log(`QR Code pixel comparison:
			- Total sampled pixels: ${firstQrPixels.pixels.length}
			- Percent different: ${percentDifferent.toFixed(2)}%
			- QR position: ${firstQrPixels.qrX}, ${firstQrPixels.qrY}
			- QR size: ${firstQrPixels.qrSize}x${firstQrPixels.qrSize}
		`);

		// Validated thresholds based on QR encoding theory:
		// - Noise floor (anti-aliasing, rendering artifacts): ~1-5%
		// - Minimum expected diff for different URLs: ~40-60%
		// - Typical diff for different URLs: ~60-90%
		// Data masking in QR codes amplifies small input changes - even a 1-bit
		// difference can cause the encoder to select a different mask pattern,
		// changing 30-50% of pixels.
		// Using 30% provides safe margin above noise while reliably detecting changes.
		expect(percentDifferent).toBeGreaterThan(30);
	});

	test('QR code should appear/disappear when toggled', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectLabelMode('General Item');

		// Add some text to show label
		await labelPage.fillPrimaryText('Test Label');

		// Initially QR code should be disabled
		await expect(labelPage.qrCodeUrlInput).toBeDisabled();

		// Enable QR code
		await labelPage.toggleQRCode();
		await expect(labelPage.qrCodeUrlInput).toBeEnabled();

		// Now fill the URL
		await labelPage.fillQRCodeUrl('https://example.com');
		await labelPage.preview.waitForReady();

		// Get QR area pixels BEFORE disabling
		const qrPixelsBefore = await labelPage.preview.getQRCodePixels();

		// Disable QR code
		await labelPage.toggleQRCode();
		await expect(labelPage.qrCodeUrlInput).toBeDisabled();

		// Wait for canvas to re-render without QR code
		await labelPage.preview.waitForLabelRender();

		// Get QR area pixels AFTER disabling
		const qrPixelsAfter = await labelPage.preview.getQRCodePixels();

		// Compare - if significantly different, QR disappeared
		const percentDiff = labelPage.preview.compareQRCodePixels(
			qrPixelsBefore.pixels,
			qrPixelsAfter.pixels
		);

		// QR code vs white background yields ~50% pixel difference (QR codes are
		// designed to have roughly 50/50 black/white balance for optimal scanning).
		// Using 20% threshold accounts for partial rendering states and provides
		// large safety margin above the noise floor (~1-5%).
		expect(percentDiff).toBeGreaterThan(20);
	});

	test('QR code should update in real-time as URL is typed', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode and enable QR
		await labelPage.selectLabelMode('General Item');
		await labelPage.fillPrimaryText('Test Label');
		await labelPage.toggleQRCode();

		// Start with a URL to ensure canvas exists
		await labelPage.fillQRCodeUrl('https://initial.com');
		await labelPage.preview.waitForLabelRender();
		await waitForQRCodeRender(page);
		const initialQr = await labelPage.preview.getQRCodePixels();

		// Clear and type first part of URL
		await labelPage.qrCodeUrlInput.click();
		await labelPage.qrCodeUrlInput.fill('https://t');
		await labelPage.preview.waitForLabelRender();
		await waitForQRCodeRender(page);
		const partialQr = await labelPage.preview.getQRCodePixels();

		// Type complete URL
		const testUrl = 'https://test.com';
		await labelPage.qrCodeUrlInput.fill(testUrl);
		await labelPage.preview.waitForLabelRender();
		await waitForQRCodeRender(page);
		const completeQr = await labelPage.preview.getQRCodePixels();

		// Each state should produce different QR codes
		const diff1 = labelPage.preview.compareQRCodePixels(initialQr.pixels, partialQr.pixels);
		const diff2 = labelPage.preview.compareQRCodePixels(partialQr.pixels, completeQr.pixels);

		console.log(`Real-time QR update test:
			- Initial vs Partial: ${diff1.toFixed(2)}% different
			- Partial vs Complete: ${diff2.toFixed(2)}% different
		`);

		// Verify QR codes changed as we typed.
		// Using 20% threshold - lower than the 30% for URL changes because partial
		// URLs (like "https://t") may produce QR codes with some structural similarity
		// to the final URL. Still safely above noise floor (~1-5%).
		expect(diff1).toBeGreaterThan(20);
		expect(diff2).toBeGreaterThan(20);
	});
});
