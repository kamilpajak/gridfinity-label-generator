import { expect, test } from '@playwright/test';
import { SingleLabelPage } from './pages/single-mode/SingleLabelPage';

test.describe('Label Generator - Single Mode', () => {
	let labelPage: SingleLabelPage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleLabelPage(page);
		await labelPage.goto();
	});

	test('should display label generator title', async () => {
		await expect(labelPage.title).toHaveText('Gridfinity Label Generator');
	});

	test('should have default label size selected', async () => {
		// Check that 12mm label is selected by default
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(false);
	});

	test('should switch between label sizes', async () => {
		// Start with 12mm (default)
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(false);
		
		// Click on 9mm label size
		await labelPage.selectLabelSize('9mm');

		// Verify 9mm is now selected and 12mm is not
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(false);

		// Verify QR and hardware image are disabled for 9mm
		await expect(labelPage.qrCodeSwitch).toBeDisabled();
		await expect(labelPage.hardwareImageSwitch).toBeDisabled();

		// Switch back to 12mm
		await labelPage.selectLabelSize('12mm');
		expect(await labelPage.isLabelSizeSelected('12mm')).toBe(true);
		expect(await labelPage.isLabelSizeSelected('9mm')).toBe(false);
		
		// Verify QR and hardware image are enabled again for 12mm
		await expect(labelPage.qrCodeSwitch).toBeEnabled();
		await expect(labelPage.hardwareImageSwitch).toBeEnabled();
	});

	test('should display label preview placeholder initially', async () => {
		// Check that placeholder is shown when there's no content
		const placeholder = labelPage.page.getByTestId('label-preview-placeholder');
		expect(await placeholder.isVisible()).toBe(true);

		// Canvas should not be visible initially
		expect(await labelPage.preview.isVisible()).toBe(false);
	});

	test('should update preview when entering primary text', async () => {
		// Switch to General Item mode to use text inputs
		await labelPage.selectLabelMode('General Item');
		
		// Enter text in primary field
		await labelPage.fillPrimaryText('M10');

		// Verify input has the value
		expect(await labelPage.getPrimaryText()).toBe('M10');

		// Canvas should now be visible
		expect(await labelPage.preview.isShowingLabel()).toBe(true);
	});

	test('should update preview when entering secondary text', async () => {
		// Switch to General Item mode to use text inputs
		await labelPage.selectLabelMode('General Item');
		
		// Enter text in secondary field
		await labelPage.fillSecondaryText('ISO 4762');

		// Verify input has the value
		expect(await labelPage.getSecondaryText()).toBe('ISO 4762');

		// Canvas should now be visible
		expect(await labelPage.preview.isShowingLabel()).toBe(true);
	});

	test('should toggle hardware image visibility', async () => {
		// Switch to General Item mode and add some content
		await labelPage.selectLabelMode('General Item');
		await labelPage.fillPrimaryText('Test');
		
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
		// Switch to General Item mode first
		await labelPage.selectLabelMode('General Item');
		// Ensure we're using 12mm (default, but be explicit)
		await labelPage.selectLabelSize('12mm');
		
		// Fill in some label content
		await labelPage.fillLabelData('M8', 'ISO 4762');

		// Export and wait for download
		const download = await labelPage.exportSection.exportLabels();

		// Verify download filename
		expect(labelPage.exportSection.verifyDownloadFilename(download, 'single')).toBe(true);
		expect(download.suggestedFilename()).toMatch(/label_\d+x\d+mm\.png/);
	});

	test('should select hardware standard from dropdown', async () => {
		// Hardware selection is only available in Fastener mode
		// (Fastener mode is the default, but let's be explicit)
		await labelPage.selectMode('fastener');
		
		// Select a hardware standard - search for 'ISO' which exists in the standards
		await labelPage.selectHardware('ISO');

		// Verify the selection was made
		const selectedText = await labelPage.getSelectedHardwareText();
		expect(selectedText).not.toBe('Select ISO/DIN standard');
		expect(selectedText).toBeTruthy();
		expect(selectedText).toContain('ISO'); // Should contain ISO or DIN
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

		// Thread size placeholder should change to imperial
		await expect(labelPage.threadSizeButton).toContainText('Select thread size');
	});

	test('should create complete label with all features', async () => {
		// Switch to General Item mode for text-based label
		await labelPage.selectLabelMode('General Item');
		// Use helper method to create complete label with 12mm (supports all features)
		// Note: unit selection is disabled in General Item mode, so we don't set it
		await labelPage.createCompleteLabel({
			size: '12mm', // Use 12mm to ensure QR and hardware image are available
			primaryText: 'M12',
			secondaryText: 'ISO 4762',
			qrUrl: 'https://example.com/m12-iso-4762',
			mode: 'general' // Explicitly set general mode (unit is not applicable here)
		});

		// Verify all elements are set correctly
		expect(await labelPage.getPrimaryText()).toBe('M12');
		expect(await labelPage.getSecondaryText()).toBe('ISO 4762');
		expect(await labelPage.isHardwareImageEnabled()).toBe(true);
		expect(await labelPage.isQRCodeEnabled()).toBe(true);
		expect(await labelPage.getQRCodeUrl()).toBe('https://example.com/m12-iso-4762');
		// Unit selection is disabled in General Item mode, so we don't check it
		expect(await labelPage.getSelectedLabelSize()).toBe('12mm');

		// Export the label
		const download = await labelPage.exportSection.exportLabels();
		expect(labelPage.exportSection.verifyDownloadFilename(download, 'single')).toBe(true);
	});

	test('should handle export with minimal configuration', async () => {
		// Switch to General Item mode first
		await labelPage.selectLabelMode('General Item');
		// Just enter primary text
		await labelPage.fillPrimaryText('TEST');

		// Should be able to export
		expect(await labelPage.exportSection.isExportEnabled()).toBe(true);

		const download = await labelPage.exportSection.exportLabels();
		expect(labelPage.exportSection.verifyDownloadFilename(download, 'single')).toBe(true);
	});
});
