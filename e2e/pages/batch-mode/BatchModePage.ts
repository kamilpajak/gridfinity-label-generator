import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';

/**
 * Page object for Batch Mode
 * Handles all interactions specific to creating multiple labels in batch
 */
export class BatchModePage extends BasePage {
	// Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;

	// Tape height selection
	readonly tapeHeight9mm: Locator;
	readonly tapeHeight12mm: Locator;

	// Label management
	readonly addLabelButton: Locator;
	readonly progressText: Locator;

	constructor(page: Page) {
		super(page);

		// Initialize components
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);

		// Initialize locators - use data-testid for stability
		this.tapeHeight9mm = page.getByTestId('tape-height-9mm');
		this.tapeHeight12mm = page.getByTestId('tape-height-12mm');

		this.addLabelButton = page.getByTestId('add-label-button');
		this.progressText = page.getByTestId('batch-progress-text');
	}

	// Override goto to ensure page is fully ready
	async goto() {
		await this.page.goto('/');
		// Wait for page to be fully loaded
		await this.page.waitForLoadState('domcontentloaded');
		await this.page.waitForLoadState('networkidle');
		// Switch to batch mode
		await this.navigation.switchToBatchMode();
		// Wait for critical elements to be visible and ready
		await this.addLabelButton.waitFor({ state: 'visible' });
		await expect(this.addLabelButton).toBeEnabled();
	}

	// Tape height methods
	async selectTapeHeight(height: '9mm' | '12mm') {
		// Check if already selected to avoid unnecessary clicks
		if (await this.isTapeHeightSelected(height)) {
			return;
		}

		const button = height === '9mm' ? this.tapeHeight9mm : this.tapeHeight12mm;
		await button.click();

		// Wait for the button to be selected (ToggleGroupItem uses data-state)
		await this.page
			.waitForFunction(
				({ buttonText }) => {
					const button = Array.from(
						document.querySelectorAll('[data-testid="tape-height-toggle"] button')
					).find((el) => el.textContent?.includes(buttonText));
					return button?.getAttribute('data-state') === 'on';
				},
				{ buttonText: height },
				{ timeout: 2000 }
			)
			.catch(() => {
				// Fallback if data-state is not available
			});

		// Give UI time to update
		await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	}

	async isTapeHeightSelected(height: '9mm' | '12mm'): Promise<boolean> {
		const button = height === '9mm' ? this.tapeHeight9mm : this.tapeHeight12mm;
		// ToggleGroupItem uses data-state="on" when selected
		const state = await button.getAttribute('data-state');
		return state === 'on';
	}

	async getSelectedTapeHeight(): Promise<'9mm' | '12mm' | null> {
		if (await this.isTapeHeightSelected('9mm')) return '9mm';
		if (await this.isTapeHeightSelected('12mm')) return '12mm';
		return null;
	}

	// Label management methods
	async addLabel() {
		// Wait for button to be enabled (not disabled)
		await this.addLabelButton.waitFor({ state: 'visible' });

		// Check if button is enabled
		const isDisabled = await this.addLabelButton.isDisabled();
		if (isDisabled) {
			throw new Error('Cannot add label: maximum labels reached');
		}

		await this.addLabelButton.click();

		// Wait for the new label to appear in the DOM
		await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
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

	// Label row methods
	getLabelRow(index: number): Locator {
		return this.page.getByTestId(`batch-label-row-${index}`);
	}

	async waitForLabel(index: number, timeout: number = 5000) {
		await this.getLabelRow(index).waitFor({ state: 'visible', timeout });
	}

	async duplicateLabel(index: number) {
		const duplicateButton = this.page.getByTestId(`duplicate-label-button-${index}`);
		await duplicateButton.click();
		// Wait for the new label to appear
		await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	}

	async deleteLabel(index: number) {
		const deleteButton = this.page.getByTestId(`delete-label-button-${index}`);
		await deleteButton.click();
		// Wait for the label to be removed
		await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	}
}
