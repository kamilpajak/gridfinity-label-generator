import { type Page, type Locator } from '@playwright/test';

/**
 * Base canvas component for label preview
 * Extended by single and batch mode previews
 */
export class BaseCanvas {
	protected page: Page;
	readonly canvas: Locator;

	constructor(page: Page) {
		this.page = page;
		this.canvas = page.locator('canvas');
	}

	/**
	 * Check if canvas is visible
	 */
	async isVisible(): Promise<boolean> {
		return await this.canvas.isVisible();
	}

	/**
	 * Get canvas width
	 */
	async getWidth(): Promise<number> {
		const width = await this.canvas.getAttribute('width');
		return width ? parseInt(width, 10) : 0;
	}

	/**
	 * Get canvas height
	 */
	async getHeight(): Promise<number> {
		const height = await this.canvas.getAttribute('height');
		return height ? parseInt(height, 10) : 0;
	}

	/**
	 * Get canvas dimensions
	 */
	async getDimensions(): Promise<{ width: number; height: number }> {
		return {
			width: await this.getWidth(),
			height: await this.getHeight()
		};
	}

	/**
	 * Wait for canvas to be ready for rendering
	 */
	async waitForReady() {
		await this.canvas.waitFor({ state: 'visible' });
		// Give time for canvas to render content
		await this.page.waitForTimeout(100);
	}

	/**
	 * Take screenshot of the canvas element
	 */
	async screenshot(path?: string): Promise<Buffer> {
		return await this.canvas.screenshot({ path });
	}

	/**
	 * Check if canvas has content (not empty)
	 * This is a basic check - can be extended for more specific validation
	 */
	async hasContent(): Promise<boolean> {
		const dimensions = await this.getDimensions();
		return dimensions.width > 0 && dimensions.height > 0;
	}
}
