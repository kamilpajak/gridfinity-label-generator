import { type Page, type Locator } from '@playwright/test';
import { GUIDELINE_COLOR_RGB } from '../../utils/canvas-geometry';
import { QRCodeValidator, type QRCodePixelData } from '../../utils/QRCodeValidator';

/**
 * Base canvas component for label preview
 * Extended by single and batch mode previews
 */
export class BaseCanvas {
	protected page: Page;
	readonly canvas: Locator;

	constructor(page: Page) {
		this.page = page;
		this.canvas = page.getByTestId('label-preview-canvas');
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
				// Wait for next animation frame to ensure canvas is ready
				await this.page.evaluate(() => {
					return new Promise((resolve) => requestAnimationFrame(resolve));
				});
				return;
			}
		} catch {
			// Canvas might not exist yet
		}

		// If canvas is not visible, that's OK - placeholder might be shown
		// Wait for DOM to stabilize
		await this.page.evaluate(() => {
			return new Promise((resolve) => requestAnimationFrame(resolve));
		});
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
		// First check if canvas is visible
		const isVisible = await this.isVisible().catch(() => false);
		if (!isVisible) return false;

		// Then check dimensions
		const dimensions = await this.getDimensions().catch(() => ({ width: 0, height: 0 }));
		return dimensions.width > 0 && dimensions.height > 0;
	}

	/**
	 * Verify that all content stays within the printable area boundaries
	 * Checks if margin areas contain only white pixels or guide lines
	 * @param labelWidth - Physical label width in mm (default: 35)
	 * @returns true if content is within bounds, false if content spills into margins
	 */
	async verifyContentWithinPrintableArea(labelWidth: number = 35): Promise<boolean> {
		// First check if canvas is visible
		const canvasVisible = await this.canvas.isVisible().catch(() => false);
		if (!canvasVisible) {
			// No canvas = no content to check, boundaries are OK
			return true;
		}

		return await this.page.evaluate(
			({ labelW, guidelineColor }) => {
				const canvas = document.querySelector('canvas');
				if (!canvas) return true;

				const ctx = canvas.getContext('2d');
				if (!ctx) return false;

				// Define the printable area boundaries
				const scale = canvas.width / labelW;
				const printableArea = {
					left: Math.round(2 * scale),
					top: Math.round(1 * scale),
					right: canvas.width - Math.round(2 * scale),
					bottom: canvas.height - Math.round(1 * scale)
				};

				// Helper to check if a pixel has content (is not white or a guideline)
				function hasContent(r: number, g: number, b: number, a: number) {
					if (a < 50) return false; // Mostly transparent is not content
					if (r > 250 && g > 250 && b > 250) return false; // White background
					if (r === guidelineColor.r && g === guidelineColor.g && b === guidelineColor.b)
						return false; // Gray guideline
					return true;
				}

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const data = imageData.data;
				let minX = canvas.width,
					minY = canvas.height,
					maxX = -1,
					maxY = -1;

				// Find the bounding box of the content
				for (let y = 0; y < canvas.height; y++) {
					for (let x = 0; x < canvas.width; x++) {
						const i = (y * canvas.width + x) * 4;
						if (hasContent(data[i], data[i + 1], data[i + 2], data[i + 3])) {
							if (x < minX) minX = x;
							if (x > maxX) maxX = x;
							if (y < minY) minY = y;
							if (y > maxY) maxY = y;
						}
					}
				}

				// If no content is found, the boundaries are not violated
				if (maxX === -1) {
					return true;
				}

				// Check if the content's bounding box is within the printable area
				// Add a small tolerance (e.g., 1 pixel) for anti-aliasing
				const tolerance = 1;
				return (
					minX >= printableArea.left - tolerance &&
					maxX <= printableArea.right + tolerance &&
					minY >= printableArea.top - tolerance &&
					maxY <= printableArea.bottom + tolerance
				);
			},
			{ labelW: labelWidth, guidelineColor: GUIDELINE_COLOR_RGB }
		);
	}

	/**
	 * Get QR code area pixels for comparison
	 * @param labelWidth - Physical label width in mm (default: 35)
	 * @returns Object with pixel data and QR code position/size
	 * @deprecated Use QRCodeValidator.getPixels() directly for new code
	 */
	async getQRCodePixels(labelWidth: number = 35): Promise<QRCodePixelData> {
		return QRCodeValidator.getPixels(this.page, labelWidth);
	}

	/**
	 * Compare two QR code pixel arrays and return percentage difference
	 * @param pixels1 - First pixel array
	 * @param pixels2 - Second pixel array
	 * @returns Percentage of pixels that are different (0-100)
	 * @deprecated Use QRCodeValidator.comparePixels() directly for new code
	 */
	compareQRCodePixels(pixels1: number[], pixels2: number[]): number {
		return QRCodeValidator.comparePixels(pixels1, pixels2);
	}
}
