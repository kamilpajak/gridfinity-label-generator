import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';
import { LabelSizeToggle } from '../components/LabelSizeToggle';
import type { LabelSize } from '../../types/page-objects';

/**
 * Page object for Batch Mode.
 *
 * In the new batch model the sidebar form is IDENTICAL to single mode. You
 * configure a label with the shared form (reuse SingleModePage form methods on
 * an already-loaded batch page) and click "Add Current Label" to snapshot it
 * into a read-only, drag-reorderable list. Rows are not editable.
 */
export class BatchModePage extends BasePage {
	// Composed Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;
	readonly tapeHeightToggle: LabelSizeToggle;

	// Label management
	readonly addLabelButton: Locator;
	readonly progressText: Locator;

	// Main-area locators
	readonly emptyState: Locator;
	readonly draftPreview: Locator;
	readonly labelList: Locator;

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

		// Main-area locators
		this.emptyState = page.getByTestId('batch-empty-state');
		this.draftPreview = page.getByTestId('batch-draft-preview');
		this.labelList = page.getByTestId('batch-label-list');

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

	/**
	 * Snapshot the current shared-form configuration into the batch list.
	 */
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

	/**
	 * Count of rendered read-only label rows.
	 */
	async getRowCount(): Promise<number> {
		return this.page.locator('[data-testid^="batch-label-row-"]').count();
	}

	async removeLabel(index: number) {
		const removeButton = this.page.getByTestId(`remove-label-button-${index}`);
		await removeButton.click();
		await this.waitForUiUpdate();
	}

	// ============================================
	// Chip Methods
	// ============================================

	getChipPrimary(index: number): Locator {
		return this.page.getByTestId(`batch-chip-primary-${index}`);
	}

	async getChipPrimaryText(index: number): Promise<string> {
		return (await this.getChipPrimary(index).textContent())?.trim() ?? '';
	}

	// ============================================
	// Reorder (keyboard drag via svelte-dnd-action)
	// ============================================

	/**
	 * Reorder a row using svelte-dnd-action keyboard dragging.
	 * Focus the row, press Space to enter drag mode, arrow to move, Space to drop.
	 */
	async reorderByKeyboard(index: number, direction: 'up' | 'down') {
		const row = this.getLabelRow(index);
		await row.focus();
		await this.page.keyboard.press('Space');
		await this.page.keyboard.press(direction === 'up' ? 'ArrowUp' : 'ArrowDown');
		await this.page.keyboard.press('Space');
		await this.waitForUiUpdate();
	}
}
