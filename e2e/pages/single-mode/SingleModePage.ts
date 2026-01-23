import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';
import { SingleLabelPreview } from '../components/SingleLabelPreview';
import { ImageUploaderComponent } from '../components/ImageUploader';
import { LabelSizeToggle } from '../components/LabelSizeToggle';
import { HardwareSelector } from '../components/HardwareSelector';
import { QRCodeSection } from '../components/QRCodeSection';
import { ThreadSizeSelector } from '../components/ThreadSizeSelector';
import {
	LABEL_WIDTH_SLIDER_RANGE,
	type LabelSize,
	type LabelMode,
	type UnitSystem,
	type CreateLabelOptions
} from '../../types/page-objects';
import { setSliderValue } from '../../utils/slider-helpers';

/**
 * Page object for Single Label mode
 * Handles all interactions specific to creating individual labels
 */
export class SingleModePage extends BasePage {
	// Composed Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;
	readonly preview: SingleLabelPreview;
	readonly labelSizeToggle: LabelSizeToggle;
	readonly hardwareSelector: HardwareSelector;
	readonly qrCodeSection: QRCodeSection;
	readonly threadSizeSelector: ThreadSizeSelector;

	// Page title
	readonly title: Locator;

	// Text inputs
	readonly primaryTextInput: Locator;
	readonly secondaryTextInput: Locator;

	// Toggle switches (non-QR)
	readonly hardwareImageSwitch: Locator;
	readonly standardReferenceSwitch: Locator;

	// Unit selection
	readonly metricButton: Locator;
	readonly imperialButton: Locator;

	// Thread size, pitch, and length
	readonly threadSizeButton: Locator;
	readonly pitchSelect: Locator;
	readonly lengthInput: Locator;

	// Optional note input
	readonly optionalNoteInput: Locator;

	// Mode selection (Fastener vs General Item)
	readonly fastenerModeButton: Locator;
	readonly generalItemModeButton: Locator;

	// Label dimensions
	readonly labelWidthSlider: Locator;
	readonly labelWidthValue: Locator;

	// Clear button
	readonly clearButton: Locator;

	// Legacy locators (kept for backward compatibility)
	readonly labelSize9mm: Locator;
	readonly labelSize12mm: Locator;
	readonly hardwareSelectButton: Locator;
	readonly hardwareSearchInput: Locator;
	readonly hardwareSearchResults: Locator;
	readonly qrCodeSwitch: Locator;
	readonly qrCodeUrlInput: Locator;

	constructor(page: Page) {
		super(page);

		// Initialize preview first (needed by other components)
		this.preview = new SingleLabelPreview(page);

		// Initialize composed components with callbacks
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);
		this.labelSizeToggle = new LabelSizeToggle(page, 'label-height');
		this.hardwareSelector = new HardwareSelector(page, () => this.preview.waitForLabelRender());
		this.qrCodeSection = new QRCodeSection(page, () => this.preview.waitForLabelRender());
		this.threadSizeSelector = new ThreadSizeSelector(page, () => this.preview.waitForLabelRender());

		// Initialize locators
		this.title = page.locator('h1');

		// Text inputs
		this.primaryTextInput = page.getByTestId('primary-text-input');
		this.secondaryTextInput = page.getByTestId('secondary-text-input');

		// Switches (non-QR)
		this.hardwareImageSwitch = page.getByTestId('hardware-image-switch');
		this.standardReferenceSwitch = page.getByTestId('standard-reference-switch');

		// Unit selection
		this.metricButton = page.getByTestId('metric-button');
		this.imperialButton = page.getByTestId('imperial-button');

		// Thread size, pitch, and length (delegated to component)
		this.threadSizeButton = this.threadSizeSelector.threadSizeButton;
		this.pitchSelect = this.threadSizeSelector.pitchSelect;
		this.lengthInput = this.threadSizeSelector.lengthInput;

		// Optional note input
		this.optionalNoteInput = page.getByTestId('optional-note-input');

		// Mode selection
		this.fastenerModeButton = page.getByTestId('mode-fastener');
		this.generalItemModeButton = page.getByTestId('mode-general');

		// Label dimensions
		this.labelWidthSlider = page.getByTestId('label-width-slider');
		this.labelWidthValue = page.locator('text=/\\d+mm/').last();

		// Clear button
		this.clearButton = page.getByTestId('clear-button');

		// Legacy locators (delegated to components but kept for backward compatibility)
		this.labelSize9mm = this.labelSizeToggle.button9mm;
		this.labelSize12mm = this.labelSizeToggle.button12mm;
		this.hardwareSelectButton = this.hardwareSelector.button;
		this.hardwareSearchInput = this.hardwareSelector.searchInput;
		this.hardwareSearchResults = this.hardwareSelector.searchResults;
		this.qrCodeSwitch = this.qrCodeSection.switch;
		this.qrCodeUrlInput = this.qrCodeSection.urlInput;
	}

	// Override goto to ensure page is fully ready
	async goto() {
		await this.page.goto('/');
		await this.page.waitForLoadState('domcontentloaded');
		await this.page.waitForLoadState('networkidle');
		await this.page.waitForSelector('[data-testid="label-mode-toggle"]', { state: 'visible' });
		await expect(this.fastenerModeButton).toBeEnabled();
	}

	// ============================================
	// Label Size Methods (delegated to component)
	// ============================================

	async selectLabelSize(size: LabelSize) {
		await this.labelSizeToggle.select(size);
		await this.waitForUiUpdate();
	}

	async isLabelSizeSelected(size: LabelSize): Promise<boolean> {
		return this.labelSizeToggle.isSelected(size);
	}

	async getSelectedLabelSize(): Promise<LabelSize | null> {
		return this.labelSizeToggle.getSelected();
	}

	// ============================================
	// Text Input Methods
	// ============================================

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

	// ============================================
	// Hardware Selection Methods (delegated to component)
	// ============================================

	async selectHardware(searchTerm: string) {
		await this.hardwareSelector.select(searchTerm);
	}

	async selectHardwareByName(searchTerm: string, namePattern: RegExp) {
		await this.hardwareSelector.selectByName(searchTerm, namePattern);
	}

	async getSelectedHardwareText(): Promise<string | null> {
		return this.hardwareSelector.getSelectedText();
	}

	// ============================================
	// Toggle Methods
	// ============================================

	async toggleHardwareImage() {
		await this.hardwareImageSwitch.click();
		await this.preview.waitForLabelRender();
	}

	async isHardwareImageEnabled(): Promise<boolean> {
		return await this.hardwareImageSwitch.isChecked();
	}

	// ============================================
	// QR Code Methods (delegated to component)
	// ============================================

	async toggleQRCode() {
		await this.qrCodeSection.toggle();
	}

	async isQRCodeEnabled(): Promise<boolean> {
		return this.qrCodeSection.isEnabled();
	}

	async fillQRCodeUrl(url: string) {
		await this.qrCodeSection.fillUrl(url);
	}

	async getQRCodeUrl(): Promise<string> {
		return this.qrCodeSection.getUrl();
	}

	// ============================================
	// Unit Selection Methods
	// ============================================

	async selectUnits(unit: UnitSystem) {
		if (unit === 'metric') {
			await this.metricButton.click();
		} else {
			await this.imperialButton.click();
		}
	}

	async isUnitSelected(unit: UnitSystem): Promise<boolean> {
		const button = unit === 'metric' ? this.metricButton : this.imperialButton;
		const state = await button.getAttribute('data-state');
		return state === 'on';
	}

	async getSelectedUnit(): Promise<UnitSystem | null> {
		if (await this.isUnitSelected('metric')) return 'metric';
		if (await this.isUnitSelected('imperial')) return 'imperial';
		return null;
	}

	// ============================================
	// Thread Size, Pitch, and Length Methods (delegated to component)
	// ============================================

	async selectThreadSize(size: string) {
		await this.threadSizeSelector.selectThreadSize(size);
	}

	async openThreadSizeDropdown() {
		await this.threadSizeSelector.openDropdown();
	}

	async getAvailableThreadSizes(): Promise<string[]> {
		return this.threadSizeSelector.getAvailableSizes();
	}

	async hasThreadSize(size: string): Promise<boolean> {
		return this.threadSizeSelector.hasSize(size);
	}

	getThreadSizeOption(size: string) {
		return this.threadSizeSelector.getOption(size);
	}

	async selectPitch(pitch: string) {
		await this.threadSizeSelector.selectPitch(pitch);
	}

	async getPitchValue(): Promise<string> {
		return this.threadSizeSelector.getPitchValue();
	}

	async isPitchFieldEnabled(): Promise<boolean> {
		return this.threadSizeSelector.isPitchEnabled();
	}

	async fillLength(length: string) {
		await this.threadSizeSelector.fillLength(length);
	}

	async getLengthValue(): Promise<string> {
		return this.threadSizeSelector.getLengthValue();
	}

	async isLengthFieldEnabled(): Promise<boolean> {
		return this.threadSizeSelector.isLengthEnabled();
	}

	async getLengthPlaceholder(): Promise<string | null> {
		return this.threadSizeSelector.getLengthPlaceholder();
	}

	// ============================================
	// Optional Note Methods
	// ============================================

	async fillOptionalNote(note: string) {
		await this.optionalNoteInput.fill(note);
		await this.preview.waitForLabelRender();
	}

	async getOptionalNote(): Promise<string> {
		return await this.optionalNoteInput.inputValue();
	}

	// ============================================
	// Mode Selection Methods
	// ============================================

	async selectMode(mode: LabelMode) {
		if (mode === 'fastener') {
			await this.fastenerModeButton.click();
			await this.threadSizeButton.waitFor({ state: 'visible', timeout: 10000 });
		} else {
			await this.generalItemModeButton.click();
			await this.primaryTextInput.waitFor({ state: 'visible', timeout: 10000 });
		}
		await this.preview.waitForReady();
	}

	async isMode(mode: LabelMode): Promise<boolean> {
		const button = mode === 'fastener' ? this.fastenerModeButton : this.generalItemModeButton;
		const state = await button.getAttribute('data-state');
		return state === 'on';
	}

	// Alias for selectMode to match test expectations
	async selectLabelMode(mode: 'Fastener' | 'General Item') {
		if (mode === 'Fastener') {
			await this.selectMode('fastener');
		} else {
			await this.selectMode('general');
		}
	}

	// ============================================
	// Label Width Methods
	// ============================================

	async setLabelWidth(width: number) {
		await setSliderValue(this.labelWidthSlider, width, LABEL_WIDTH_SLIDER_RANGE);
		await this.preview.waitForLabelRender();
	}

	async getLabelWidth(): Promise<number> {
		const value = await this.labelWidthSlider.inputValue();
		return parseInt(value, 10);
	}

	async getLabelWidthDisplay(): Promise<string> {
		return (await this.labelWidthValue.textContent()) || '';
	}

	// ============================================
	// Clear Form Method
	// ============================================

	async clearForm() {
		await this.clearButton.click();
		await this.preview.waitForReady();
	}

	// ============================================
	// Image Uploader
	// ============================================

	/**
	 * Get ImageUploader component for single mode
	 * Only visible in General Item mode with 12mm tape
	 */
	getImageUploader(): ImageUploaderComponent {
		return new ImageUploaderComponent(this.page, 'single');
	}

	// ============================================
	// Complete Label Creation Helper
	// ============================================

	async createCompleteLabel(options: CreateLabelOptions) {
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

		// Select hardware if specified (only works in fastener mode)
		if (options.hardware && options.mode === 'fastener') {
			await this.selectHardware(options.hardware);
		}

		// Add QR code if URL provided
		if (options.qrUrl) {
			await this.qrCodeSection.enable();
			await this.fillQRCodeUrl(options.qrUrl);
		}

		// Wait for final render
		await this.preview.waitForLabelRender();
	}
}
