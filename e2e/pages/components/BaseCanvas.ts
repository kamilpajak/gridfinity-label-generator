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

	/**
	 * Get QR code area pixels for comparison
	 * @param labelWidth - Physical label width in mm (default: 35)
	 * @returns Object with pixel data and QR code position/size
	 */
	async getQRCodePixels(labelWidth: number = 35): Promise<{
		pixels: number[];
		qrX: number;
		qrY: number;
		qrSize: number;
		canvasWidth: number;
		canvasHeight: number;
	}> {
		return await this.page.evaluate((width) => {
			const canvas = document.querySelector('canvas');
			if (!canvas) throw new Error('Canvas not found');

			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Could not get canvas context');

			// In preview mode, canvas is translated by (2mm, 1mm)
			const scale = canvas.width / width;
			const translateOffset = {
				x: Math.round(2 * scale), // 2mm translate
				y: Math.round(1 * scale)  // 1mm translate
			};

			// QR code is 10x10mm, positioned on the right side
			const qrSize = Math.round(10 * scale);
			const margin = Math.round(2 * scale); // 2mm margin
			
			// QR code should be at right edge minus margin, accounting for translate
			const qrX = canvas.width - margin - qrSize - translateOffset.x;
			const qrY = margin + translateOffset.y; // Top edge plus margin

			// Get image data for QR code area
			const imageData = ctx.getImageData(qrX, qrY, qrSize, qrSize);
			
			// Convert to simple array for comparison
			// Sample every 10th pixel to reduce data size
			const pixels: number[] = [];
			for (let i = 0; i < imageData.data.length; i += 40) { // Every 10th pixel (4 bytes per pixel)
				pixels.push(imageData.data[i]); // Red channel only
			}
			
			return {
				pixels,
				qrX,
				qrY,
				qrSize,
				canvasWidth: canvas.width,
				canvasHeight: canvas.height
			};
		}, labelWidth);
	}

	/**
	 * Compare two QR code pixel arrays and return percentage difference
	 * @param pixels1 - First pixel array
	 * @param pixels2 - Second pixel array
	 * @returns Percentage of pixels that are different (0-100)
	 */
	compareQRCodePixels(pixels1: number[], pixels2: number[]): number {
		if (pixels1.length !== pixels2.length) {
			throw new Error('Pixel arrays must have the same length');
		}

		let differentPixels = 0;
		for (let i = 0; i < pixels1.length; i++) {
			if (pixels1[i] !== pixels2[i]) {
				differentPixels++;
			}
		}

		return (differentPixels / pixels1.length) * 100;
	}

	/**
	 * Check if QR code area has content (not just white background)
	 * @param labelWidth - Physical label width in mm (default: 35)
	 * @returns true if QR code is present, false if area is empty
	 */
	async hasQRCodeContent(labelWidth: number = 35): Promise<boolean> {
		return await this.page.evaluate((width) => {
			const canvas = document.querySelector('canvas');
			if (!canvas) return false;

			const ctx = canvas.getContext('2d');
			if (!ctx) return false;

			// In preview mode, canvas is translated by (2mm, 1mm)
			const scale = canvas.width / width;
			const translateOffset = {
				x: Math.round(2 * scale), // 2mm translate
				y: Math.round(1 * scale)  // 1mm translate
			};

			// Check right edge area where QR code should be
			const qrSize = Math.round(10 * scale);
			const margin = Math.round(2 * scale);
			const qrX = canvas.width - margin - qrSize - translateOffset.x;
			const qrY = margin + translateOffset.y;

			// Sample multiple points in a 3x3 grid within QR area
			const samplePoints = [];
			const step = qrSize / 4; // Sample at 25%, 50%, 75% positions
			
			for (let i = 1; i <= 3; i++) {
				for (let j = 1; j <= 3; j++) {
					const x = Math.round(qrX + step * i);
					const y = Math.round(qrY + step * j);
					samplePoints.push({ x, y });
				}
			}

			// Check each sample point
			let nonWhiteCount = 0;
			for (const point of samplePoints) {
				const imageData = ctx.getImageData(point.x, point.y, 1, 1);
				const [r, g, b] = imageData.data;
				
				// Consider it non-white if any channel is not 255 (with tolerance)
				const tolerance = 250; // Allow slight variations
				if (r < tolerance || g < tolerance || b < tolerance) {
					nonWhiteCount++;
				}
			}
			
			// If at least 30% of sampled points are non-white, QR code is likely present
			return nonWhiteCount >= Math.floor(samplePoints.length * 0.3);
		}, labelWidth);
	}
}
