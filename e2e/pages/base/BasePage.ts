import { type Page } from '@playwright/test';

/**
 * Base class for all page objects
 * Contains common functionality shared across all pages
 */
export abstract class BasePage {
	protected page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/**
	 * Navigate to the application
	 */
	async goto() {
		await this.page.goto('/');
	}

	/**
	 * Wait for page to be fully loaded
	 */
	async waitForPageLoad() {
		await this.page.waitForLoadState('networkidle');
	}

	/**
	 * Get current page title
	 */
	async getPageTitle(): Promise<string | null> {
		return await this.page.title();
	}

	/**
	 * Take a screenshot for debugging
	 */
	async takeScreenshot(name: string) {
		await this.page.screenshot({ path: `screenshots/${name}.png` });
	}

	/**
	 * Wait for the next animation frame, allowing the UI to update.
	 * Use this after actions that trigger DOM changes to ensure updates are processed.
	 */
	async waitForUiUpdate() {
		await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	}
}
