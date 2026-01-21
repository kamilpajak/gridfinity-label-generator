import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';
import { ImageUploaderComponent } from '../components/ImageUploader';
import { LabelSizeToggle } from '../components/LabelSizeToggle';
import type { LabelSize } from '../../types/page-objects';

/**
 * Page object for Batch Mode
 * Handles all interactions specific to creating multiple labels in batch
 */
export class BatchModePage extends BasePage {
	// Composed Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;
	readonly tapeHeightToggle: LabelSizeToggle;

	// Label management
	readonly addLabelButton: Locator;
	readonly progressText: Locator;

	// Legacy locators (kept for backward compatibility)
	readonly tapeHeight9mm: Locator;
	readonly tapeHeight12mm: Locator;

	constructor(page: Page) {
		super(page);

		// Initialize composed components
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);
		this.tapeHeightToggle = new LabelSizeToggle(page, 'tape-height');

		// Initialize locators
		this.addLabelButton = page.getByTestId('add-label-button');
		this.progressText = page.getByTestId('batch-progress-text');

		// Legacy locators (delegated to component)
		this.tapeHeight9mm = this.tapeHeightToggle.button9mm;
		this.tapeHeight12mm = this.tapeHeightToggle.button12mm;
	}

	// Override goto to ensure page is fully ready
	async goto() {
		await this.page.goto('/');
		await this.page.waitForLoadState('domcontentloaded');
		await this.page.waitForLoadState('networkidle');
		// Switch to batch mode
		await this.navigation.switchToBatchMode();
		// Wait for critical elements to be visible and ready
		await this.addLabelButton.waitFor({ state: 'visible' });
		await expect(this.addLabelButton).toBeEnabled();
	}

	// ============================================
	// Tape Height Methods (delegated to component)
	// ============================================

	async selectTapeHeight(height: LabelSize) {
		await this.tapeHeightToggle.select(height);
	}

	async isTapeHeightSelected(height: LabelSize): Promise<boolean> {
		return this.tapeHeightToggle.isSelected(height);
	}

	async getSelectedTapeHeight(): Promise<LabelSize | null> {
		return this.tapeHeightToggle.getSelected();
	}

	// ============================================
	// Label Management Methods
	// ============================================

	async addLabel() {
		await this.addLabelButton.waitFor({ state: 'visible' });

		const isDisabled = await this.addLabelButton.isDisabled();
		if (isDisabled) {
			throw new Error('Cannot add label: maximum labels reached');
		}

		await this.addLabelButton.click();
		await this.waitForUiUpdate();
	}

	async canAddLabel(): Promise<boolean> {
		return !(await this.addLabelButton.isDisabled());
	}

	async getProgress(): Promise<string> {
		return (await this.progressText.textContent()) ?? '';
	}

	async getLabelCount(): Promise<number> {
		const text = await this.getProgress();
		const match = text.match(/(\d+) \/ \d+ labels/);
		return match ? parseInt(match[1], 10) : 0;
	}

	async getMaxLabels(): Promise<number> {
		const text = await this.getProgress();
		const match = text.match(/\d+ \/ (\d+) labels/);
		return match ? parseInt(match[1], 10) : 0;
	}

	// ============================================
	// Label Row Methods
	// ============================================

	getLabelRow(index: number): Locator {
		return this.page.getByTestId(`batch-label-row-${index}`);
	}

	async waitForLabel(index: number, timeout: number = 5000) {
		await this.getLabelRow(index).waitFor({ state: 'visible', timeout });
	}

	async duplicateLabel(index: number) {
		const duplicateButton = this.page.getByTestId(`duplicate-label-button-${index}`);
		await duplicateButton.click();
		await this.waitForUiUpdate();
	}

	async deleteLabel(index: number) {
		const deleteButton = this.page.getByTestId(`delete-label-button-${index}`);
		await deleteButton.click();
		await this.waitForUiUpdate();
	}

	// ============================================
	// Label Mode Methods
	// ============================================

	/**
	 * Switch label mode between Hardware and General Item
	 * @param index - Label index (0-based)
	 * @param mode - Target mode: 'hardware' or 'general'
	 */
	async switchLabelMode(index: number, mode: 'hardware' | 'general') {
		const modeToggle = this.page.getByTestId(`label-mode-toggle-${index}`);
		const buttonText = mode === 'general' ? 'General Item' : 'Hardware';
		const button = modeToggle.locator(`button:has-text("${buttonText}")`);
		await button.click();
		await this.waitForUiUpdate();
	}

	// ============================================
	// Component Accessors
	// ============================================

	/**
	 * Get ImageUploader component for a specific label
	 * @param index - Label index (0-based)
	 */
	getImageUploader(index: number): ImageUploaderComponent {
		return new ImageUploaderComponent(this.page, index);
	}

	/**
	 * Get primary text input for a label
	 * @param index - Label index (0-based)
	 */
	getPrimaryTextInput(index: number): Locator {
		return this.page.getByTestId(`primary-text-input-${index}`);
	}
}
