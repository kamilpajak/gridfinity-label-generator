import { Page } from '@playwright/test';

/**
 * Wait for canvas to be stable (no ongoing renders)
 * @param page - Playwright page object
 * @param selector - Canvas selector (default: 'canvas')
 * @param options - Wait options
 */
export async function waitForCanvasStable(
	page: Page,
	selector: string = '[data-testid="label-preview-canvas"]',
	options: { timeout?: number; pollInterval?: number; optional?: boolean } = {}
) {
	const { timeout = 5000, pollInterval = 100, optional = false } = options;

	// First check if canvas exists
	const canvasExists = await page.locator(selector).count() > 0;
	if (!canvasExists && optional) {
		return; // Canvas doesn't exist and that's OK
	}

	await page.waitForFunction(
		({ selector, pollInterval }) => {
			return new Promise((resolve) => {
				const canvas = document.querySelector(selector) as HTMLCanvasElement;
				if (!canvas) {
					resolve(false);
					return;
				}

				let lastImageData: string | null = null;
				let stableCount = 0;
				const requiredStableChecks = 2;

				const checkStability = () => {
					const ctx = canvas.getContext('2d');
					if (!ctx) {
						resolve(false);
						return;
					}

					// Get a sample of the canvas content
					const imageData = ctx.getImageData(0, 0, 50, 50).data;
					const currentData = Array.from(imageData).join(',');

					if (lastImageData === currentData) {
						stableCount++;
						if (stableCount >= requiredStableChecks) {
							resolve(true);
							return;
						}
					} else {
						stableCount = 0;
					}

					lastImageData = currentData;
					setTimeout(checkStability, pollInterval);
				};

				checkStability();
			});
		},
		{ selector, pollInterval },
		{ timeout, polling: 'raf' }
	);
}

/**
 * Wait for all images on the page to be loaded
 * @param page - Playwright page object
 * @param options - Wait options
 */
export async function waitForImagesLoaded(
	page: Page,
	options: { timeout?: number } = {}
) {
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
export async function waitForNetworkIdle(
	page: Page,
	options: { timeout?: number } = {}
) {
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
	const elementExists = await page.locator(selector).count() > 0;
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

	// First ensure canvas exists
	await page.getByTestId('label-preview-canvas').waitFor({ state: 'visible', timeout });

	await page.waitForFunction(
		({ labelWidth }) => {
			const canvas = document.querySelector('canvas') as HTMLCanvasElement;
			if (!canvas) return false;

			const ctx = canvas.getContext('2d');
			if (!ctx) return false;

			// In preview mode, canvas is translated by (2mm, 1mm)
			const scale = canvas.width / labelWidth;
			const translateOffset = {
				x: Math.round(2 * scale), // 2mm translate
				y: Math.round(1 * scale)  // 1mm translate
			};

			// Check QR code area for non-white pixels
			const qrSize = Math.round(10 * scale);
			const margin = Math.round(2 * scale);
			// QR code position accounting for translate
			const qrX = canvas.width - margin - qrSize - translateOffset.x;
			const qrY = margin + translateOffset.y;

			// Sample center of QR code area
			const imageData = ctx.getImageData(
				qrX + qrSize / 2,
				qrY + qrSize / 2,
				1,
				1
			);

			// If it's not white, QR code is rendered
			return (
				imageData.data[0] !== 255 ||
				imageData.data[1] !== 255 ||
				imageData.data[2] !== 255
			);
		},
		{ labelWidth },
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