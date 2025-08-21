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
			({ labelW }) => {
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
				function hasContent(r, g, b, a) {
					if (a < 50) return false; // Mostly transparent is not content
					if (r > 250 && g > 250 && b > 250) return false; // White background
					if (r === 243 && g === 244 && b === 246) return false; // Gray guideline
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
				y: Math.round(1 * scale) // 1mm translate
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
			for (let i = 0; i < imageData.data.length; i += 40) {
				// Every 10th pixel (4 bytes per pixel)
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
				y: Math.round(1 * scale) // 1mm translate
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
