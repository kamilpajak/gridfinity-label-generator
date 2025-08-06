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
	 * Note: Canvas might not be visible if placeholder is shown (no content)
	 */
	async waitForReady() {
		// Wait for either canvas or placeholder to be visible
		try {
			// First check if canvas exists and is visible
			const canvasVisible = await this.canvas.isVisible();
			if (canvasVisible) {
				// Give time for canvas to render content
				await this.page.waitForTimeout(100);
				return;
			}
		} catch {
			// Canvas might not exist yet
		}

		// If canvas is not visible, that's OK - placeholder might be shown
		// Just wait a bit for the page to stabilize
		await this.page.waitForTimeout(200);
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

	/**
	 * Verify that all content stays within the printable area boundaries
	 * Checks if margin areas contain only white pixels or guide lines
	 * @param labelWidth - Physical label width in mm (default: 35)
	 * @param labelHeight - Physical label height in mm (default: 12)
	 * @returns true if content is within bounds, false if content spills into margins
	 */
	async verifyContentWithinPrintableArea(
		labelWidth: number = 35,
		labelHeight: number = 12
	): Promise<boolean> {
		// First check if canvas is visible
		const canvasVisible = await this.canvas.isVisible().catch(() => false);
		if (!canvasVisible) {
			// No canvas = no content to check, boundaries are OK
			return true;
		}

		return await this.page.evaluate(
			({ labelW, labelH }) => {
				const canvas = document.querySelector('canvas');
				if (!canvas) return true; // No canvas = no content outside boundaries

				const ctx = canvas.getContext('2d');
				if (!ctx) return false;

				// Calculate scale based on canvas size
				const scale = canvas.width / labelW;

				// Check if this is preview mode (with visual margins)
				// In preview mode, the coordinate system is translated by (2mm, 1mm)
				const isPreviewMode = true; // Preview always has showMargins: true
				const translateOffset = isPreviewMode
					? {
							x: Math.round(2 * scale), // 2mm translate
							y: Math.round(1 * scale) // 1mm translate
						}
					: { x: 0, y: 0 };

				// Define actual content boundaries (accounting for translate)
				const contentBounds = {
					left: translateOffset.x,
					right: canvas.width - translateOffset.x,
					top: translateOffset.y,
					bottom: canvas.height - translateOffset.y
				};

				// Helper function to check if a pixel is white or gray guideline
				function isPixelAllowed(r: number, g: number, b: number, a: number): boolean {
					// White background
					if (r === 255 && g === 255 && b === 255) return true;

					// Gray guideline (#f3f4f6)
					if (r === 243 && g === 244 && b === 246) return true;

					// Transparent
					if (a === 0) return true;

					// Allow slight variations due to anti-aliasing (tolerance of 5)
					const tolerance = 5;
					const isNearWhite =
						Math.abs(r - 255) <= tolerance &&
						Math.abs(g - 255) <= tolerance &&
						Math.abs(b - 255) <= tolerance;

					const isNearGray =
						Math.abs(r - 243) <= tolerance &&
						Math.abs(g - 244) <= tolerance &&
						Math.abs(b - 246) <= tolerance;

					return isNearWhite || isNearGray;
				}

				// Check if a pixel contains content (not background/guideline)
				function hasContent(r: number, g: number, b: number, a: number): boolean {
					return !isPixelAllowed(r, g, b, a);
				}

				const { width, height } = canvas;

				// Scan the canvas to find content bounds
				let contentFound = false;

				// Check areas outside the content bounds
				// Left area (before content starts)
				if (contentBounds.left > 0) {
					const leftAreaData = ctx.getImageData(0, 0, contentBounds.left, height);
					const data = leftAreaData.data;
					for (let i = 0; i < data.length; i += 4) {
						if (hasContent(data[i], data[i + 1], data[i + 2], data[i + 3])) {
							// Skip pixels that are part of the gray guideline
							const x = (i / 4) % contentBounds.left;
							const y = Math.floor(i / 4 / contentBounds.left);
							// Check if this is near the boundary line (within 1 pixel)
							if (Math.abs(x - (contentBounds.left - 1)) > 1) {
								return false; // Found content in left margin
							}
						}
					}
				}

				// Right area (after content ends)
				if (contentBounds.right < width) {
					const rightAreaData = ctx.getImageData(
						contentBounds.right,
						0,
						width - contentBounds.right,
						height
					);
					const data = rightAreaData.data;
					for (let i = 0; i < data.length; i += 4) {
						if (hasContent(data[i], data[i + 1], data[i + 2], data[i + 3])) {
							// Skip pixels that are part of the gray guideline
							const x = (i / 4) % (width - contentBounds.right);
							// Check if this is near the boundary line (within 1 pixel)
							if (x > 1) {
								return false; // Found content in right margin
							}
						}
					}
				}

				// Top area (before content starts)
				if (contentBounds.top > 0) {
					const topAreaData = ctx.getImageData(0, 0, width, contentBounds.top);
					const data = topAreaData.data;
					for (let i = 0; i < data.length; i += 4) {
						if (hasContent(data[i], data[i + 1], data[i + 2], data[i + 3])) {
							// Skip pixels that are part of the gray guideline
							const y = Math.floor(i / 4 / width);
							// Check if this is near the boundary line (within 1 pixel)
							if (Math.abs(y - (contentBounds.top - 1)) > 1) {
								return false; // Found content in top margin
							}
						}
					}
				}

				// Bottom area (after content ends)
				if (contentBounds.bottom < height) {
					const bottomAreaData = ctx.getImageData(
						0,
						contentBounds.bottom,
						width,
						height - contentBounds.bottom
					);
					const data = bottomAreaData.data;
					for (let i = 0; i < data.length; i += 4) {
						if (hasContent(data[i], data[i + 1], data[i + 2], data[i + 3])) {
							// Skip pixels that are part of the gray guideline
							const y = Math.floor(i / 4 / width);
							// Check if this is near the boundary line (within 1 pixel)
							if (y > 1) {
								return false; // Found content in bottom margin
							}
						}
					}
				}

				return true; // All margins are clean
			},
			{ labelW: labelWidth, labelH: labelHeight }
		);
	}
}
