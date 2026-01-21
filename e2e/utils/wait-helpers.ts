import { Page, expect } from '@playwright/test';
import {
	CANVAS_TRANSLATE_MM,
	QR_CODE_SIZE_MM,
	CANVAS_MARGIN_MM,
	QR_DETECTION_THRESHOLD
} from './canvas-geometry';

/**
 * Wait for all images on the page to be loaded
 * @param page - Playwright page object
 * @param options - Wait options
 */
export async function waitForImagesLoaded(page: Page, options: { timeout?: number } = {}) {
	const { timeout = 5000 } = options;

	await page.waitForFunction(
		() => {
			const images = Array.from(document.querySelectorAll('img'));
			return images.every((img) => img.complete && img.naturalHeight !== 0);
		},
		{ timeout }
	);
}

/**
 * Wait for network to be idle (no ongoing requests)
 * @param page - Playwright page object
 * @param options - Wait options
 */
export async function waitForNetworkIdle(page: Page, options: { timeout?: number } = {}) {
	await page.waitForLoadState('networkidle', options);
}

/**
 * Wait for a specific data attribute to have a value
 * @param page - Playwright page object
 * @param selector - Element selector
 * @param attribute - Data attribute name (without 'data-' prefix)
 * @param value - Expected value
 * @param options - Wait options
 */
export async function waitForDataAttribute(
	page: Page,
	selector: string,
	attribute: string,
	value: string,
	options: { timeout?: number; optional?: boolean } = {}
) {
	const { timeout = 5000, optional = false } = options;

	// First check if element exists
	const elementExists = (await page.locator(selector).count()) > 0;
	if (!elementExists && optional) {
		return; // Element doesn't exist and that's OK
	}

	await page.waitForFunction(
		({ selector, attribute, value }) => {
			const element = document.querySelector(selector);
			return element?.getAttribute(`data-${attribute}`) === value;
		},
		{ selector, attribute, value },
		{ timeout }
	);
}

/**
 * Wait for QR code to be rendered on canvas
 * @param page - Playwright page object
 * @param options - Wait options
 */
export async function waitForQRCodeRender(
	page: Page,
	options: { timeout?: number; labelWidth?: number } = {}
) {
	const { timeout = 5000, labelWidth = 35 } = options;

	// First ensure canvas exists and is stable using event-driven approach
	const canvas = page.getByTestId('label-preview-canvas');
	await canvas.waitFor({ state: 'visible', timeout });
	await expect(canvas).toHaveAttribute('data-render-status', 'stable', { timeout });

	// Then verify QR code pixels are actually rendered
	await page.waitForFunction(
		({ labelWidth, translateMM, qrSizeMM, marginMM, detectionThreshold }) => {
			const canvas = document.querySelector('canvas') as HTMLCanvasElement;
			if (!canvas) return false;

			const ctx = canvas.getContext('2d');
			if (!ctx) return false;

			// Calculate QR code bounds from shared constants
			const scale = canvas.width / labelWidth;
			const translateOffset = {
				x: Math.round(translateMM.x * scale),
				y: Math.round(translateMM.y * scale)
			};
			const qrSize = Math.round(qrSizeMM * scale);
			const margin = Math.round(marginMM * scale);
			const qrX = canvas.width - margin - qrSize - translateOffset.x;
			const qrY = margin + translateOffset.y;

			// Sample multiple points in QR area (3x3 grid)
			const samplePoints = [];
			const step = qrSize / 4;

			for (let i = 1; i <= 3; i++) {
				for (let j = 1; j <= 3; j++) {
					samplePoints.push({
						x: Math.round(qrX + step * i),
						y: Math.round(qrY + step * j)
					});
				}
			}

			// Check if at least some points are non-white
			let nonWhiteCount = 0;
			for (const point of samplePoints) {
				const imageData = ctx.getImageData(point.x, point.y, 1, 1);
				const [r, g, b] = imageData.data;

				// Check if not white (with tolerance)
				if (r < 250 || g < 250 || b < 250) {
					nonWhiteCount++;
				}
			}

			// If enough points are non-white, QR is rendered
			return nonWhiteCount >= Math.floor(samplePoints.length * detectionThreshold);
		},
		{
			labelWidth,
			translateMM: CANVAS_TRANSLATE_MM,
			qrSizeMM: QR_CODE_SIZE_MM,
			marginMM: CANVAS_MARGIN_MM,
			detectionThreshold: QR_DETECTION_THRESHOLD
		},
		{ timeout }
	);
}

/**
 * Wait for canvas content to change
 * @param page - Playwright page object
 * @param previousImageData - Previous image data to compare against
 * @param options - Wait options
 */
export async function waitForCanvasChange(
	page: Page,
	previousImageData: number[],
	options: { timeout?: number; selector?: string } = {}
) {
	const { timeout = 5000, selector = '[data-testid="label-preview-canvas"]' } = options;

	await page.waitForFunction(
		({ selector, previousData }) => {
			const canvas = document.querySelector(selector) as HTMLCanvasElement;
			if (!canvas) return false;

			const ctx = canvas.getContext('2d');
			if (!ctx) return false;

			// Get current image data
			const currentData = ctx.getImageData(0, 0, 50, 50).data;

			// Compare with previous data
			for (let i = 0; i < previousData.length; i++) {
				if (currentData[i] !== previousData[i]) {
					return true; // Content has changed
				}
			}

			return false;
		},
		{ selector, previousData: previousImageData },
		{ timeout }
	);
}

/**
 * Get a sample of canvas image data for comparison
 * @param page - Playwright page object
 * @param selector - Canvas selector
 */
export async function getCanvasSample(
	page: Page,
	selector: string = '[data-testid="label-preview-canvas"]'
): Promise<number[]> {
	return await page.evaluate((selector) => {
		const canvas = document.querySelector(selector) as HTMLCanvasElement;
		if (!canvas) return [];

		const ctx = canvas.getContext('2d');
		if (!ctx) return [];

		const imageData = ctx.getImageData(0, 0, 50, 50).data;
		return Array.from(imageData);
	}, selector);
}
