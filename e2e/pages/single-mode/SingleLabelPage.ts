import { type Page, type Locator } from '@playwright/test';
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

	constructor(page: Page) {
		super(page);

		// Initialize components
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);
		this.preview = new SingleLabelPreview(page);

		// Initialize locators
		this.title = page.locator('h1');

		// Label size buttons
		this.labelSize9mm = page.getByRole('button', { name: '9mm', exact: true });
		this.labelSize12mm = page.getByRole('button', { name: '12mm', exact: true });

		// Text inputs
		this.primaryTextInput = page.getByPlaceholder('Primary text (e.g., M8)');
		this.secondaryTextInput = page.getByPlaceholder('Description (e.g., ISO 4762)');

		// Hardware selection
		this.hardwareSelectButton = page.getByRole('button', { name: 'Select hardware' });
		this.hardwareSearchInput = page.getByPlaceholder('Search standards...');

		// Switches
		this.hardwareImageSwitch = page.getByRole('switch', { name: 'Hardware Image' });
		this.qrCodeSwitch = page.getByRole('switch', { name: 'QR Code' });

		// QR URL input
		this.qrCodeUrlInput = page.getByPlaceholder('URL for QR code');

		// Unit selection
		this.metricButton = page.getByRole('button', { name: 'Metric', exact: true });
		this.imperialButton = page.getByRole('button', { name: 'Imperial', exact: true });

		// Thread size
		this.threadSizeButton = page.locator('#thread-size').locator('..');
	}

	// Label size methods
	async selectLabelSize(size: '9mm' | '12mm') {
		if (size === '9mm') {
			await this.labelSize9mm.click();
		} else {
			await this.labelSize12mm.click();
		}
		// Wait for canvas to update
		await this.preview.waitForReady();
	}

	async isLabelSizeSelected(size: '9mm' | '12mm'): Promise<boolean> {
		const button = size === '9mm' ? this.labelSize9mm : this.labelSize12mm;
		const state = await button.getAttribute('data-state');
		return state === 'on';
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
		await this.preview.waitForLabelRender();
	}

	async fillSecondaryText(text: string) {
		await this.secondaryTextInput.fill(text);
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
		await this.qrCodeSwitch.click();
		// Wait for QR input to appear/disappear
		if (await this.qrCodeSwitch.isChecked()) {
			await this.qrCodeUrlInput.waitFor({ state: 'visible' });
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
		const button = unit === 'metric' ? this.metricButton : this.imperialButton;
		const state = await button.getAttribute('data-state');
		return state === 'on';
	}

	async getSelectedUnit(): Promise<'metric' | 'imperial' | null> {
		if (await this.isUnitSelected('metric')) return 'metric';
		if (await this.isUnitSelected('imperial')) return 'imperial';
		return null;
	}

	// Complete label creation helper
	async createCompleteLabel(options: {
		size: '9mm' | '12mm';
		primaryText: string;
		secondaryText: string;
		hardware?: string;
		qrUrl?: string;
		unit?: 'metric' | 'imperial';
	}) {
		// Set label size
		await this.selectLabelSize(options.size);

		// Set unit if specified
		if (options.unit) {
			await this.selectUnits(options.unit);
		}

		// Fill text fields
		await this.fillLabelData(options.primaryText, options.secondaryText);

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
