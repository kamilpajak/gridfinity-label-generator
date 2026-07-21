import { type Page, type Locator, type Download, expect } from '@playwright/test';

/**
 * Export section component shared between Single and Batch modes
 * Handles PNG export functionality
 */
export class ExportSection {
	private page: Page;

	readonly exportButton: Locator;
	readonly downloadProgress: Locator;
	readonly exportedConfirmation: Locator;

	constructor(page: Page) {
		this.page = page;

		// Use data-testid for reliable selection
		this.exportButton = page.getByTestId('export-button');
		// Progress indicator for future implementation
		this.downloadProgress = page.getByTestId('download-progress');
		// Batch export success message ("✓ Exported N labels successfully")
		this.exportedConfirmation = page.locator('text=✓ Exported');
	}

	/**
	 * Click export button and wait for download
	 */
	async exportLabels(): Promise<Download> {
		const downloadPromise = this.page.waitForEvent('download');
		await this.exportButton.click();
		return await downloadPromise;
	}

	/**
	 * Click the export button without waiting for a download.
	 *
	 * Used by tests that intercept `HTMLCanvasElement.prototype.toBlob` instead
	 * of a browser download event (see {@link captureNextExportCanvasDimensions}).
	 */
	async clickExport(): Promise<void> {
		await this.exportButton.click();
	}

	/**
	 * Install a one-shot spy on `HTMLCanvasElement.prototype.toBlob` and resolve
	 * with the dimensions of the next canvas that is exported. Call this BEFORE
	 * triggering the export, then await the returned promise afterwards.
	 */
	async captureNextExportCanvasDimensions(): Promise<{ width: number; height: number }> {
		return this.page.evaluate(() => {
			return new Promise<{ width: number; height: number }>((resolve) => {
				const originalToBlob = HTMLCanvasElement.prototype.toBlob;
				HTMLCanvasElement.prototype.toBlob = function (
					callback: BlobCallback,
					type?: string,
					quality?: number
				) {
					const dimensions = { width: this.width, height: this.height };
					// Restore original immediately so only the first export is captured
					HTMLCanvasElement.prototype.toBlob = originalToBlob;
					resolve(dimensions);
					return originalToBlob.call(this, callback, type, quality);
				};
			});
		});
	}

	/**
	 * Assert the batch export success message is shown.
	 */
	async expectExportSuccess(): Promise<void> {
		await expect(this.exportedConfirmation).toBeVisible({ timeout: 5000 });
	}

	/**
	 * Check if export button is enabled
	 */
	async isExportEnabled(): Promise<boolean> {
		return await this.exportButton.isEnabled();
	}

	/**
	 * Wait for export button to be ready
	 */
	async waitForExportReady() {
		await this.exportButton.waitFor({ state: 'visible' });
		await this.exportButton.waitFor({ state: 'enabled' });
	}

	/**
	 * Get expected filename pattern based on mode
	 * Since PR #44, filenames are descriptive based on label content:
	 * - General: PRIMARY_SECONDARY.png or PRIMARY.png
	 * - Fastener: STANDARD_THREADSIZExLENGTHmm.png
	 * - Batch: labels-batch-Nx-WxHmm.png
	 */
	getExpectedFilenamePattern(mode: 'single' | 'batch'): RegExp {
		if (mode === 'single') {
			// Single label: descriptive name based on content
			// Examples: M8_ISO4762.png, DIN912_M6x20mm.png, Resistors_100Ohm.png
			return /^[\w.-]+\.png$/;
		} else {
			// Batch labels: labels-batch-5x-31x10mm.png (5 labels example)
			return /labels-batch-\d+x-\d+x\d+mm\.png/;
		}
	}

	/**
	 * Verify the downloaded file has correct filename
	 */
	verifyDownloadFilename(download: Download, mode: 'single' | 'batch'): boolean {
		const filename = download.suggestedFilename();
		const pattern = this.getExpectedFilenamePattern(mode);
		return pattern.test(filename);
	}

	/**
	 * Wait for download progress to complete (for future batch exports)
	 */
	async waitForDownloadComplete(timeout = 30000) {
		// This will be used when we have progress indication for large batch exports
		await this.downloadProgress.waitFor({ state: 'hidden', timeout });
	}
}
