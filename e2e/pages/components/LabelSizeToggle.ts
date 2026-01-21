import { type Page, type Locator } from '@playwright/test';
import type { LabelSize } from '../../types/page-objects';

/**
 * Shared component for label/tape size selection toggle
 * Used by both SingleModePage (label-height) and BatchModePage (tape-height)
 */
export class LabelSizeToggle {
	private page: Page;
	private testIdPrefix: string;

	readonly button9mm: Locator;
	readonly button12mm: Locator;

	/**
	 * @param page - Playwright page object
	 * @param testIdPrefix - The data-testid prefix ('label-height' for single, 'tape-height' for batch)
	 */
	constructor(page: Page, testIdPrefix: 'label-height' | 'tape-height') {
		this.page = page;
		this.testIdPrefix = testIdPrefix;

		// Locate buttons within the toggle group
		const toggleGroup = page.getByTestId(`${testIdPrefix}-toggle`);
		this.button9mm = toggleGroup.getByText('9mm');
		this.button12mm = toggleGroup.getByText('12mm');
	}

	/**
	 * Select a label size
	 * @param size - The size to select ('9mm' or '12mm')
	 */
	async select(size: LabelSize): Promise<void> {
		// Check if already selected to avoid unnecessary clicks
		if (await this.isSelected(size)) {
			return;
		}

		const button = size === '9mm' ? this.button9mm : this.button12mm;
		await button.click();

		// Wait for the button to be selected (ToggleGroupItem uses data-state)
		await this.page
			.waitForFunction(
				({ prefix, buttonText }) => {
					const button = Array.from(
						document.querySelectorAll(`[data-testid="${prefix}-toggle"] button`)
					).find((el) => el.textContent?.includes(buttonText));
					return button?.getAttribute('data-state') === 'on';
				},
				{ prefix: this.testIdPrefix, buttonText: size },
				{ timeout: 2000 }
			)
			.catch(() => {
				// Fallback if data-state is not available
			});

		// Give UI time to update
		await this.waitForUiUpdate();
	}

	/**
	 * Check if a specific size is currently selected
	 * @param size - The size to check
	 */
	async isSelected(size: LabelSize): Promise<boolean> {
		const button = size === '9mm' ? this.button9mm : this.button12mm;
		// ToggleGroupItem uses data-state="on" when selected
		const state = await button.getAttribute('data-state');
		return state === 'on';
	}

	/**
	 * Get the currently selected size
	 */
	async getSelected(): Promise<LabelSize | null> {
		if (await this.isSelected('9mm')) return '9mm';
		if (await this.isSelected('12mm')) return '12mm';
		return null;
	}

	/**
	 * Wait for the next animation frame
	 */
	private async waitForUiUpdate(): Promise<void> {
		await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	}
}
