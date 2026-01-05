import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the What's New card component
 * Displays flat list of individual changes (not grouped by version)
 */
export class WhatsNewCard {
	readonly page: Page;
	readonly card: Locator;
	readonly header: Locator;
	readonly versionBadge: Locator;
	readonly scrollContainer: Locator;
	readonly items: Locator;
	readonly loadingIndicator: Locator;

	constructor(page: Page) {
		this.page = page;
		this.card = page.getByTestId('whats-new-card');
		this.header = this.card.locator('[data-testid="whats-new-header"]');
		this.versionBadge = this.card.getByTestId('version-badge');
		this.scrollContainer = this.card.getByTestId('whats-new-scroll');
		this.items = this.card.getByTestId('whats-new-item');
		this.loadingIndicator = this.card.getByText('Loading more...');
	}

	async isVisible(): Promise<boolean> {
		return await this.card.isVisible();
	}

	async getVersion(): Promise<string> {
		return (await this.versionBadge.textContent()) || '';
	}

	async getItemCount(): Promise<number> {
		return await this.items.count();
	}

	async scrollToBottom(): Promise<void> {
		await this.scrollContainer.evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
	}

	/**
	 * Get titles of all visible items
	 * (In flat view, each item shows the change title, not version)
	 */
	async getItemTitles(): Promise<string[]> {
		const titles: string[] = [];
		const count = await this.items.count();
		for (let i = 0; i < count; i++) {
			// item-version testid now contains title (legacy naming)
			const titleText = await this.items.nth(i).getByTestId('item-version').textContent();
			if (titleText) titles.push(titleText.trim());
		}
		return titles;
	}

	/**
	 * @deprecated Use getItemTitles() instead - structure changed to flat view
	 */
	async getItemVersions(): Promise<string[]> {
		return this.getItemTitles();
	}
}
