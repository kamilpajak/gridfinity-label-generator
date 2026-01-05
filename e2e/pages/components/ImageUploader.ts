import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object component for Custom Image Uploader
 * Handles all interactions with the image upload functionality in General Mode labels
 * Supports both batch mode (numeric index) and single mode (string identifier)
 */
export class ImageUploaderComponent {
	private page: Page;
	private testIdPrefix: string;

	// Locators
	readonly container: Locator;
	readonly dropzone: Locator;
	readonly fileInput: Locator;
	readonly preview: Locator;
	readonly thumbnail: Locator;
	readonly filename: Locator;
	readonly removeButton: Locator;

	constructor(page: Page, identifier: number | string) {
		this.page = page;
		this.testIdPrefix = `custom-image-uploader-${identifier}`;

		// Initialize locators based on identifier
		this.container = page.getByTestId(this.testIdPrefix);
		this.dropzone = page.getByTestId(`${this.testIdPrefix}-dropzone`);
		this.fileInput = page.getByTestId(`${this.testIdPrefix}-input`);
		this.preview = page.getByTestId(`${this.testIdPrefix}-preview`);
		this.thumbnail = page.getByTestId(`${this.testIdPrefix}-thumbnail`);
		this.filename = page.getByTestId(`${this.testIdPrefix}-filename`);
		this.removeButton = page.getByTestId(`${this.testIdPrefix}-remove`);
	}

	/**
	 * Upload a file via the file input
	 */
	async uploadFile(filePath: string) {
		await this.fileInput.setInputFiles(filePath);
	}

	/**
	 * Wait for the preview to appear after upload
	 */
	async waitForPreview(timeout: number = 10000) {
		await expect(this.preview).toBeVisible({ timeout });
	}

	/**
	 * Remove the uploaded image
	 */
	async removeImage() {
		await this.removeButton.click();
		// Wait for dropzone to reappear
		await expect(this.dropzone).toBeVisible();
	}

	/**
	 * Get the displayed filename
	 */
	async getFilename(): Promise<string> {
		return (await this.filename.textContent()) ?? '';
	}

	/**
	 * Check if an image is currently uploaded (preview visible)
	 */
	async hasImage(): Promise<boolean> {
		return await this.preview.isVisible();
	}

	/**
	 * Check if the uploader is visible (component is rendered)
	 */
	async isVisible(): Promise<boolean> {
		return await this.container.isVisible();
	}

	/**
	 * Check if dropzone is visible (no image uploaded)
	 */
	async isDropzoneVisible(): Promise<boolean> {
		return await this.dropzone.isVisible();
	}

	/**
	 * Get the error message if present
	 */
	async getErrorMessage(): Promise<string | null> {
		const errorLocator = this.page.getByTestId(`${this.testIdPrefix}-error`);
		if (await errorLocator.isVisible()) {
			return await errorLocator.textContent();
		}
		return null;
	}

	/**
	 * Wait for error message to appear
	 */
	async waitForError(timeout: number = 5000) {
		const errorLocator = this.page.getByTestId(`${this.testIdPrefix}-error`);
		await expect(errorLocator).toBeVisible({ timeout });
	}

	/**
	 * Upload file and wait for preview
	 */
	async uploadAndWaitForPreview(filePath: string, timeout: number = 10000) {
		await this.uploadFile(filePath);
		await this.waitForPreview(timeout);
	}

	/**
	 * Verify thumbnail is displayed
	 */
	async expectThumbnailVisible() {
		await expect(this.thumbnail).toBeVisible();
	}

	/**
	 * Verify filename contains expected text
	 */
	async expectFilenameContains(text: string) {
		await expect(this.filename).toContainText(text);
	}

	/**
	 * Assert that preview is visible (image uploaded)
	 */
	async expectPreviewVisible() {
		await expect(this.preview).toBeVisible();
	}

	/**
	 * Assert that no image is uploaded (dropzone visible, preview hidden)
	 */
	async expectNoImage() {
		await expect(this.preview).not.toBeVisible();
		await expect(this.dropzone).toBeVisible();
	}

	/**
	 * Assert that dropzone is visible
	 */
	async expectDropzoneVisible() {
		await expect(this.dropzone).toBeVisible();
	}
}
