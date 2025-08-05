import { expect, test } from '@playwright/test';
import { SingleLabelPage } from './pages/single-mode/SingleLabelPage';

test.describe('Label Generator - Single Mode', () => {
	let labelPage: SingleLabelPage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleLabelPage(page);
		await labelPage.goto();
	});

	test('should display label generator title', async () => {
		await expect(labelPage.title).toHaveText('GridScribe');
	});

	test('should have default label size selected', async () => {
		// Check that 12mm label is selected by default
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(false);
	});

	test('should switch between label sizes', async () => {
		// Click on 9mm label size
		await labelPage.selectLabelSize('9mm');

		// Verify 9mm is now selected and 12mm is not
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(false);

		// Verify canvas updated
		expect(await labelPage.preview.verifyLabelDimensions('9mm')).toBe(true);

		// Switch back to 12mm
		await labelPage.selectLabelSize('12mm');
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(false);
	});

	test('should display label preview canvas', async () => {
		// Check that canvas element exists and has content
		expect(await labelPage.preview.isVisible()).toBe(true);
		expect(await labelPage.preview.isShowingLabel()).toBe(true);

		// Verify default size
		const dimensions = await labelPage.preview.getDimensions();
		expect(dimensions.width).toBeGreaterThan(0);
		expect(dimensions.height).toBeGreaterThan(0);
	});

	test('should update preview when entering primary text', async () => {
		// Enter text in primary field
		await labelPage.fillPrimaryText('M10');

		// Verify input has the value
		expect(await labelPage.getPrimaryText()).toBe('M10');

		// Canvas should still be visible
		expect(await labelPage.preview.isShowingLabel()).toBe(true);
	});

	test('should update preview when entering secondary text', async () => {
		// Enter text in secondary field
		await labelPage.fillSecondaryText('ISO 4762');

		// Verify input has the value
		expect(await labelPage.getSecondaryText()).toBe('ISO 4762');

		// Canvas should still be visible
		expect(await labelPage.preview.isShowingLabel()).toBe(true);
	});

	test('should toggle hardware image visibility', async () => {
		// Check initial state (should be checked)
		expect(await labelPage.isHardwareImageEnabled()).toBe(true);

		// Toggle off
		await labelPage.toggleHardwareImage();
		expect(await labelPage.isHardwareImageEnabled()).toBe(false);

		// Toggle back on
		await labelPage.toggleHardwareImage();
		expect(await labelPage.isHardwareImageEnabled()).toBe(true);
	});

	test('should toggle QR code visibility', async () => {
		// Check initial state (should be unchecked)
		expect(await labelPage.isQRCodeEnabled()).toBe(false);

		// Toggle on
		await labelPage.toggleQRCode();
		expect(await labelPage.isQRCodeEnabled()).toBe(true);

		// URL input should appear
		await expect(labelPage.qrCodeUrlInput).toBeVisible();

		// Enter URL
		await labelPage.fillQRCodeUrl('https://example.com');
		expect(await labelPage.getQRCodeUrl()).toBe('https://example.com');
	});

	test('should be able to export label as PNG', async () => {
		// Fill in some label content
		await labelPage.fillLabelData('M8', 'ISO 4762');

		// Export and wait for download
		const download = await labelPage.exportSection.exportLabels();

		// Verify download filename
		expect(labelPage.exportSection.verifyDownloadFilename(download, 'single')).toBe(true);
		expect(download.suggestedFilename()).toMatch(/label_\d+x\d+mm\.png/);
	});

	test('should select hardware standard from dropdown', async () => {
		// Select a hardware standard
		await labelPage.selectHardware('hex');

		// Verify the selection was made
		const selectedText = await labelPage.getSelectedHardwareText();
		expect(selectedText).not.toBe('Select hardware');
		expect(selectedText).toBeTruthy();
	});

	test('should switch between metric and imperial units', async () => {
		// Initially metric should be selected
		expect(await labelPage.isUnitSelected('metric')).toBe(true);
		expect(await labelPage.isUnitSelected('imperial')).toBe(false);

		// Click imperial
		await labelPage.selectUnits('imperial');

		// Verify imperial is now selected
		expect(await labelPage.isUnitSelected('imperial')).toBe(true);
		expect(await labelPage.isUnitSelected('metric')).toBe(false);

		// Thread size placeholder should change
		await expect(labelPage.threadSizeButton).toContainText('Thread size (e.g., 1/4″)');
	});

	test('should create complete label with all features', async () => {
		// Use helper method to create complete label
		await labelPage.createCompleteLabel({
			size: '12mm',
			primaryText: 'M12',
			secondaryText: 'ISO 4762',
			hardware: 'socket',
			qrUrl: 'https://example.com/m12-iso-4762',
			unit: 'metric'
		});

		// Verify all elements are set correctly
		expect(await labelPage.getPrimaryText()).toBe('M12');
		expect(await labelPage.getSecondaryText()).toBe('ISO 4762');
		expect(await labelPage.isHardwareImageEnabled()).toBe(true);
		expect(await labelPage.isQRCodeEnabled()).toBe(true);
		expect(await labelPage.getQRCodeUrl()).toBe('https://example.com/m12-iso-4762');
		expect(await labelPage.getSelectedUnit()).toBe('metric');
		expect(await labelPage.getSelectedLabelSize()).toBe('12mm');

		// Export the label
		const download = await labelPage.exportSection.exportLabels();
		expect(labelPage.exportSection.verifyDownloadFilename(download, 'single')).toBe(true);
	});

	test('should handle export with minimal configuration', async () => {
		// Just enter primary text
		await labelPage.fillPrimaryText('TEST');

		// Should be able to export
		expect(await labelPage.exportSection.isExportEnabled()).toBe(true);

		const download = await labelPage.exportSection.exportLabels();
		expect(labelPage.exportSection.verifyDownloadFilename(download, 'single')).toBe(true);
	});
});
