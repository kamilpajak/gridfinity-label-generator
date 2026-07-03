import { type Page, type Locator } from '@playwright/test';

/** Test id of the hardware/standard select trigger */
export const HARDWARE_SELECT_TESTID = 'hardware-select';

/**
 * Component for hardware/standard selection with search functionality
 * Encapsulates the Command popover interaction pattern
 */
export class HardwareSelector {
	private page: Page;

	readonly button: Locator;
	readonly searchInput: Locator;
	readonly searchResults: Locator;

	/**
	 * Callback to wait for label render after selection
	 * Injected by parent page object to avoid circular dependencies
	 */
	private onSelectionComplete?: () => Promise<void>;

	constructor(page: Page, onSelectionComplete?: () => Promise<void>) {
		this.page = page;
		this.onSelectionComplete = onSelectionComplete;

		// Initialize locators
		this.button = page.getByTestId(HARDWARE_SELECT_TESTID);
		this.searchInput = page.getByPlaceholder('Search standards...');
		this.searchResults = page.locator('[data-slot="command-item"]');
	}

	/**
	 * Select hardware by search term (clicks first result)
	 * @param searchTerm - Text to search for
	 */
	async select(searchTerm: string): Promise<void> {
		await this.button.waitFor({ state: 'visible' });
		await this.button.click();
		await this.searchInput.waitFor({ state: 'visible' });
		await this.searchInput.fill(searchTerm);

		// Wait for search results to appear
		await this.searchResults.first().waitFor({ state: 'visible' });

		// Click on the first matching item
		await this.searchResults.first().click();

		// Wait for popover to close
		await this.page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });

		// Notify parent to wait for render
		if (this.onSelectionComplete) {
			await this.onSelectionComplete();
		}
	}

	/**
	 * Select hardware by search term and name pattern
	 * @param searchTerm - Text to search for
	 * @param namePattern - RegExp pattern to match the option name
	 */
	async selectByName(searchTerm: string, namePattern: RegExp): Promise<void> {
		await this.button.waitFor({ state: 'visible' });

		// Wait for any prior animations to settle before clicking
		await this.waitForButtonStable();

		await this.button.click();
		await this.searchInput.waitFor({ state: 'visible' });
		await this.searchInput.fill(searchTerm);

		// Wait for search results to appear
		await this.searchResults.first().waitFor({ state: 'visible' });

		// Click on the matching item by name pattern
		await this.page.getByRole('option', { name: namePattern }).first().click();

		// Wait for popover to close
		await this.page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });

		// Notify parent to wait for render
		if (this.onSelectionComplete) {
			await this.onSelectionComplete();
		}
	}

	/**
	 * Get the currently selected hardware text
	 */
	async getSelectedText(): Promise<string | null> {
		return await this.button.textContent();
	}

	/**
	 * Check if the selector is visible and ready
	 */
	async isVisible(): Promise<boolean> {
		return await this.button.isVisible();
	}

	/**
	 * Wait for the hardware select button to be stable (not animating)
	 * Checks that the button's bounding box hasn't changed over animation frames
	 */
	private async waitForButtonStable(): Promise<void> {
		await this.page.waitForFunction(
			(selector) => {
				const button = document.querySelector(selector);
				if (!button) return false;

				return new Promise<boolean>((resolve) => {
					const rect1 = button.getBoundingClientRect();
					requestAnimationFrame(() => {
						const rect2 = button.getBoundingClientRect();
						// Check if button position/size hasn't changed
						const stable =
							rect1.x === rect2.x &&
							rect1.y === rect2.y &&
							rect1.width === rect2.width &&
							rect1.height === rect2.height;
						resolve(stable);
					});
				});
			},
			'[data-testid="hardware-select"]',
			{ timeout: 5000 }
		);
	}
}
