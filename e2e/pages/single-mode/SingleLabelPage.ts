import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';
import { SingleLabelPreview } from './SingleLabelPreview';

/**
 * Page object for Single Label mode
 * Handles all interactions specific to creating individual labels
 */
export class SingleLabelPage extends BasePage {
	// Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;
	readonly preview: SingleLabelPreview;

	// Page title
	readonly title: Locator;

	// Label size selection
	readonly labelSize9mm: Locator;
	readonly labelSize12mm: Locator;

	// Text inputs
	readonly primaryTextInput: Locator;
	readonly secondaryTextInput: Locator;

	// Hardware standard selection
	readonly hardwareSelectButton: Locator;
	readonly hardwareSearchInput: Locator;

	// Toggle switches
	readonly hardwareImageSwitch: Locator;
	readonly qrCodeSwitch: Locator;

	// QR Code input
	readonly qrCodeUrlInput: Locator;

	// Unit selection
	readonly metricButton: Locator;
	readonly imperialButton: Locator;

	// Thread size
	readonly threadSizeButton: Locator;

	// Mode selection (Fastener vs General Item)
	readonly fastenerModeButton: Locator;
	readonly generalItemModeButton: Locator;

	constructor(page: Page) {
		super(page);

		// Initialize components
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);
		this.preview = new SingleLabelPreview(page);

		// Initialize locators
		this.title = page.locator('h1');

		// Label size selection - use data-testid for stability
		this.labelSize9mm = page.getByTestId('label-height-toggle').getByText('9mm');
		this.labelSize12mm = page.getByTestId('label-height-toggle').getByText('12mm');

		// Text inputs - use data-testid for stability
		this.primaryTextInput = page.getByTestId('primary-text-input');
		this.secondaryTextInput = page.getByTestId('secondary-text-input');

		// Hardware selection - this is a combobox
		this.hardwareSelectButton = page.getByRole('combobox');
		this.hardwareSearchInput = page.getByPlaceholder('Search standards...');

		// Switches - use data-testid for reliability
		this.hardwareImageSwitch = page.getByTestId('hardware-image-switch');
		this.qrCodeSwitch = page.getByTestId('qr-code-switch');

		// QR URL input - use data-testid for stability
		this.qrCodeUrlInput = page.getByTestId('qr-code-url-input');

		// Unit selection radio buttons
		this.metricButton = page.getByRole('radio', { name: 'Metric', exact: true });
		this.imperialButton = page.getByRole('radio', { name: 'Imperial', exact: true });

		// Thread size
		this.threadSizeButton = page.locator('#thread-size').locator('..');

		// Mode selection - use data-testid and target the toggle items
		this.fastenerModeButton = page.getByTestId('label-mode-toggle').getByText('Fastener');
		this.generalItemModeButton = page.getByTestId('label-mode-toggle').getByText('General Item');
	}

	// Label size methods
	async selectLabelSize(size: '9mm' | '12mm') {
		if (size === '9mm') {
			await this.labelSize9mm.click();
		} else {
			await this.labelSize12mm.click();
		}
		// Give a moment for state to update
		await this.page.waitForTimeout(100);
		// Wait for preview to update (handles both canvas and placeholder)
		await this.preview.waitForLabelRender();
	}

	async isLabelSizeSelected(size: '9mm' | '12mm'): Promise<boolean> {
		const radio = size === '9mm' ? this.labelSize9mm : this.labelSize12mm;
		return await radio.isChecked();
	}

	async getSelectedLabelSize(): Promise<'9mm' | '12mm' | null> {
		if (await this.isLabelSizeSelected('9mm')) return '9mm';
		if (await this.isLabelSizeSelected('12mm')) return '12mm';
		return null;
	}

	// Text input methods
	async fillLabelData(primary: string, secondary: string) {
		await this.fillPrimaryText(primary);
		await this.fillSecondaryText(secondary);
	}

	async fillPrimaryText(text: string) {
		await this.primaryTextInput.fill(text);
		// Give a moment for state to update
		await this.page.waitForTimeout(100);
		// Now wait for render (handles both canvas and placeholder states)
		await this.preview.waitForLabelRender();
	}

	async fillSecondaryText(text: string) {
		await this.secondaryTextInput.fill(text);
		// Give a moment for state to update
		await this.page.waitForTimeout(100);
		// Now wait for render (handles both canvas and placeholder states)
		await this.preview.waitForLabelRender();
	}

	async getPrimaryText(): Promise<string> {
		return await this.primaryTextInput.inputValue();
	}

	async getSecondaryText(): Promise<string> {
		return await this.secondaryTextInput.inputValue();
	}

	// Hardware selection methods
	async selectHardware(searchTerm: string) {
		await this.hardwareSelectButton.click();
		await this.hardwareSearchInput.fill(searchTerm);
		await this.page.getByRole('option').first().click();
		await this.preview.waitForLabelRender();
	}

	async getSelectedHardwareText(): Promise<string | null> {
		return await this.hardwareSelectButton.textContent();
	}

	// Toggle methods
	async toggleHardwareImage() {
		await this.hardwareImageSwitch.click();
		await this.preview.waitForLabelRender();
	}

	async isHardwareImageEnabled(): Promise<boolean> {
		return await this.hardwareImageSwitch.isChecked();
	}

	async toggleQRCode() {
		// Check the state before clicking
		const wasEnabledBefore = await this.qrCodeUrlInput.isEnabled().catch(() => false);
		
		// Use data-testid for reliable selection
		await this.qrCodeSwitch.click();
		
		// Wait for the opposite state
		if (wasEnabledBefore) {
			// When disabling, the input becomes disabled, not hidden
			await expect(this.qrCodeUrlInput).toBeDisabled();
		} else {
			// When enabling, wait for it to be enabled
			await expect(this.qrCodeUrlInput).toBeEnabled();
		}
	}

	async isQRCodeEnabled(): Promise<boolean> {
		return await this.qrCodeSwitch.isChecked();
	}

	async fillQRCodeUrl(url: string) {
		await this.qrCodeUrlInput.fill(url);
		await this.preview.waitForLabelRender();
	}

	async getQRCodeUrl(): Promise<string> {
		return await this.qrCodeUrlInput.inputValue();
	}

	// Unit selection methods
	async selectUnits(unit: 'metric' | 'imperial') {
		if (unit === 'metric') {
			await this.metricButton.click();
		} else {
			await this.imperialButton.click();
		}
	}

	async isUnitSelected(unit: 'metric' | 'imperial'): Promise<boolean> {
		const radio = unit === 'metric' ? this.metricButton : this.imperialButton;
		return await radio.isChecked();
	}

	async getSelectedUnit(): Promise<'metric' | 'imperial' | null> {
		if (await this.isUnitSelected('metric')) return 'metric';
		if (await this.isUnitSelected('imperial')) return 'imperial';
		return null;
	}

	// Mode selection methods
	async selectMode(mode: 'fastener' | 'general') {
		if (mode === 'fastener') {
			await this.fastenerModeButton.click();
		} else {
			await this.generalItemModeButton.click();
		}
		await this.preview.waitForReady();
	}

	async isMode(mode: 'fastener' | 'general'): Promise<boolean> {
		const radio = mode === 'fastener' ? this.fastenerModeButton : this.generalItemModeButton;
		return await radio.isChecked();
	}

	// Alias for selectMode to match test expectations
	async selectLabelMode(mode: 'Fastener' | 'General Item') {
		if (mode === 'Fastener') {
			await this.selectMode('fastener');
		} else {
			await this.selectMode('general');
		}
	}

	// Complete label creation helper
	async createCompleteLabel(options: {
		size: '9mm' | '12mm';
		primaryText: string;
		secondaryText: string;
		hardware?: string;
		qrUrl?: string;
		unit?: 'metric' | 'imperial';
		mode?: 'fastener' | 'general';
	}) {
		// Set mode (default to general for direct text input)
		await this.selectMode(options.mode || 'general');

		// Set label size
		await this.selectLabelSize(options.size);

		// Set unit if specified
		if (options.unit) {
			await this.selectUnits(options.unit);
		}

		// Fill text fields (only works in general mode)
		if (options.mode !== 'fastener') {
			await this.fillLabelData(options.primaryText, options.secondaryText);
		}

		// Select hardware if specified
		if (options.hardware) {
			await this.selectHardware(options.hardware);
		}

		// Add QR code if URL provided
		if (options.qrUrl) {
			if (!(await this.isQRCodeEnabled())) {
				await this.toggleQRCode();
			}
			await this.fillQRCodeUrl(options.qrUrl);
		}

		// Wait for final render
		await this.preview.waitForLabelRender();
	}
}
