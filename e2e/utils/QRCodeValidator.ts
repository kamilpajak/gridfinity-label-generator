import { type Page } from '@playwright/test';
import { CANVAS_TRANSLATE_MM, QR_CODE_SIZE_MM, CANVAS_MARGIN_MM } from './canvas-geometry';

/**
 * QR code pixel data returned from getPixels
 */
export interface QRCodePixelData {
	pixels: number[];
	qrX: number;
	qrY: number;
	qrSize: number;
	canvasWidth: number;
	canvasHeight: number;
}

/**
 * Utility class for QR code validation and pixel comparison
 * Extracted from BaseCanvas to separate concerns
 */
export class QRCodeValidator {
	/**
	 * Get QR code area pixels from the canvas for comparison
	 * @param page - Playwright page object
	 * @param labelWidth - Physical label width in mm (default: 35)
	 * @returns Object with pixel data and QR code position/size
	 */
	static async getPixels(page: Page, labelWidth: number = 35): Promise<QRCodePixelData> {
		return await page.evaluate(
			({ width, translateMM, qrSizeMM, marginMM }) => {
				const canvas = document.querySelector('canvas');
				if (!canvas) throw new Error('Canvas not found');

				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('Could not get canvas context');

				// Calculate QR code bounds from shared constants
				const scale = canvas.width / width;
				const translateOffset = {
					x: Math.round(translateMM.x * scale),
					y: Math.round(translateMM.y * scale)
				};
				const qrSize = Math.round(qrSizeMM * scale);
				const margin = Math.round(marginMM * scale);
				const qrX = canvas.width - margin - qrSize - translateOffset.x;
				const qrY = margin + translateOffset.y;

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
			},
			{
				width: labelWidth,
				translateMM: CANVAS_TRANSLATE_MM,
				qrSizeMM: QR_CODE_SIZE_MM,
				marginMM: CANVAS_MARGIN_MM
			}
		);
	}

	/**
	 * Compare two QR code pixel arrays and return percentage difference
	 * @param pixels1 - First pixel array
	 * @param pixels2 - Second pixel array
	 * @returns Percentage of pixels that are different (0-100)
	 */
	static comparePixels(pixels1: number[], pixels2: number[]): number {
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
	 * Check if QR codes are significantly different (>5% pixel difference)
	 * @param pixels1 - First pixel array
	 * @param pixels2 - Second pixel array
	 * @param threshold - Minimum percentage difference to consider "different" (default: 5)
	 */
	static areSignificantlyDifferent(
		pixels1: number[],
		pixels2: number[],
		threshold: number = 5
	): boolean {
		return QRCodeValidator.comparePixels(pixels1, pixels2) > threshold;
	}
}
