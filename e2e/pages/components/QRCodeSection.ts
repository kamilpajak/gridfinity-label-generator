import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Component for QR code toggle and URL input
 * Handles the QR code section in single label mode
 */
export class QRCodeSection {
	private page: Page;

	readonly switch: Locator;
	readonly urlInput: Locator;

	/**
	 * Callback to wait for label render after changes
	 * Injected by parent page object to avoid circular dependencies
	 */
	private onContentChange?: () => Promise<void>;

	constructor(page: Page, onContentChange?: () => Promise<void>) {
		this.page = page;
		this.onContentChange = onContentChange;

		// Initialize locators using data-testid
		this.switch = page.getByTestId('qr-code-switch');
		this.urlInput = page.getByTestId('qr-code-url-input');
	}

	/**
	 * Toggle the QR code on or off
	 * Waits for the switch state to change and input to reflect the new state
	 */
	async toggle(): Promise<void> {
		// Check the switch state before clicking
		const wasCheckedBefore = await this.switch.isChecked();

		await this.switch.click();

		// Wait for the switch state to change and input to reflect the new state
		if (wasCheckedBefore) {
			// When toggling off, wait for switch to be unchecked and input to be disabled
			await expect(this.switch).not.toBeChecked();
			await expect(this.urlInput).toBeDisabled();
		} else {
			// When toggling on, wait for switch to be checked and input to be enabled
			await expect(this.switch).toBeChecked();
			await expect(this.urlInput).toBeEnabled();
		}
	}

	/**
	 * Check if QR code is currently enabled
	 */
	async isEnabled(): Promise<boolean> {
		return await this.switch.isChecked();
	}

	/**
	 * Fill the QR code URL
	 * @param url - The URL to encode in the QR code
	 */
	async fillUrl(url: string): Promise<void> {
		await this.urlInput.fill(url);

		// Notify parent to wait for render
		if (this.onContentChange) {
			await this.onContentChange();
		}
	}

	/**
	 * Get the current QR code URL
	 */
	async getUrl(): Promise<string> {
		return await this.urlInput.inputValue();
	}

	/**
	 * Check if the URL input is visible
	 */
	async isUrlInputVisible(): Promise<boolean> {
		return await this.urlInput.isVisible();
	}

	/**
	 * Enable QR code if not already enabled
	 */
	async enable(): Promise<void> {
		if (!(await this.isEnabled())) {
			await this.toggle();
		}
	}

	/**
	 * Disable QR code if currently enabled
	 */
	async disable(): Promise<void> {
		if (await this.isEnabled()) {
			await this.toggle();
		}
	}
}
