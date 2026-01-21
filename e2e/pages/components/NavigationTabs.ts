import { type Page, type Locator } from '@playwright/test';

/**
 * Navigation tabs component for switching between Single and Batch modes
 */
export class NavigationTabs {
	private page: Page;

	readonly singleModeTab: Locator;
	readonly batchModeTab: Locator;

	constructor(page: Page) {
		this.page = page;

		this.singleModeTab = page.getByRole('tab', { name: 'Single Label' });
		this.batchModeTab = page.getByRole('tab', { name: 'Batch Mode' });
	}

	/**
	 * Switch to Single Label mode
	 */
	async switchToSingleMode() {
		await this.singleModeTab.click();
		// Wait for tab panel to be visible
		await this.page.waitForSelector('[role="tabpanel"]', { state: 'visible' });
	}

	/**
	 * Switch to Batch Mode
	 */
	async switchToBatchMode() {
		await this.batchModeTab.click();
		// Wait for batch mode tab to be active
		await this.page.waitForFunction(
			() => {
				const batchTab = document.querySelector('[role="tab"][aria-selected="true"]');
				return batchTab?.textContent?.includes('Batch Mode');
			},
			{ timeout: 5000 }
		);
	}

	/**
	 * Check if a specific tab is active
	 */
	async isTabActive(tab: 'single' | 'batch'): Promise<boolean> {
		const locator = tab === 'single' ? this.singleModeTab : this.batchModeTab;
		const ariaSelected = await locator.getAttribute('aria-selected');
		return ariaSelected === 'true';
	}

	/**
	 * Get the currently active tab
	 */
	async getActiveTab(): Promise<'single' | 'batch' | null> {
		if (await this.isTabActive('single')) return 'single';
		if (await this.isTabActive('batch')) return 'batch';
		return null;
	}
}
