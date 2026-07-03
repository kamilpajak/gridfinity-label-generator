import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the What's New modal component
 * Displays timeline of changelog entries grouped by version
 */
export class WhatsNewModal {
	readonly page: Page;
	readonly button: Locator;
	readonly backdrop: Locator;
	readonly modal: Locator;
	readonly closeButton: Locator;
	readonly closeButtonFooter: Locator;
	readonly entries: Locator;
	readonly categoryTags: Locator;

	constructor(page: Page) {
		this.page = page;
		this.button = page.getByTestId('whats-new-button');
		this.backdrop = page.getByTestId('whats-new-modal-backdrop');
		this.modal = page.getByTestId('whats-new-modal');
		this.closeButton = page.getByTestId('whats-new-modal-close');
		this.closeButtonFooter = page.getByTestId('whats-new-modal-close-button');
		this.entries = page.getByTestId('whats-new-entry');
		this.categoryTags = page.getByTestId('category-tag');
	}

	/**
	 * Navigate to the app and wait for the header (including this modal's trigger)
	 * to be ready. Replaces an inline goto + networkidle wait in tests.
	 */
	async goto(): Promise<void> {
		await this.page.goto('/');
		// networkidle lets Svelte 5 hydration finish before the modal trigger is
		// clicked (required for Chromium/WebKit).
		await this.page.waitForLoadState('networkidle');
		await this.button.waitFor({ state: 'visible' });
	}

	async open(): Promise<void> {
		await this.button.click();
		await this.modal.waitFor({ state: 'visible' });
	}

	async close(): Promise<void> {
		await this.closeButton.click();
		await this.modal.waitFor({ state: 'hidden' });
	}

	async closeViaFooter(): Promise<void> {
		await this.closeButtonFooter.click();
		await this.modal.waitFor({ state: 'hidden' });
	}

	async closeViaBackdrop(): Promise<void> {
		// Click on the backdrop (outside the modal)
		await this.backdrop.click({ position: { x: 10, y: 10 } });
		await this.modal.waitFor({ state: 'hidden' });
	}

	async closeViaEscape(): Promise<void> {
		await this.page.keyboard.press('Escape');
		await this.modal.waitFor({ state: 'hidden' });
	}

	async isVisible(): Promise<boolean> {
		return await this.modal.isVisible();
	}

	async isButtonVisible(): Promise<boolean> {
		return await this.button.isVisible();
	}

	async getEntryCount(): Promise<number> {
		return await this.entries.count();
	}

	async getCategoryTagCount(): Promise<number> {
		return await this.categoryTags.count();
	}

	async getEntryVersions(): Promise<string[]> {
		const versions: string[] = [];
		const count = await this.entries.count();
		for (let i = 0; i < count; i++) {
			const versionText = await this.entries.nth(i).getByTestId('whats-new-version').textContent();
			if (versionText) versions.push(versionText.trim());
		}
		return versions;
	}
}
