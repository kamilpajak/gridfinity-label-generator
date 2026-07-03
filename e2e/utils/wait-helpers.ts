import { Page, expect } from '@playwright/test';

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
 * Wait for QR code to be rendered on canvas.
 *
 * Uses the event-driven data-render-status attribute set by the app
 * after rendering completes. This is the contract between app and tests.
 *
 * Note: Previous implementation included pixel sampling verification,
 * but this was redundant - if data-render-status='stable' but QR isn't
 * rendered, that's an app bug to catch with visual regression tests,
 * not a wait helper concern.
 *
 * @param page - Playwright page object
 * @param options - Wait options
 */
export async function waitForQRCodeRender(page: Page, options: { timeout?: number } = {}) {
	const { timeout = 5000 } = options;

	// Each tab guards its preview with `{#if mode === ...}`, so only one
	// `label-preview-canvas` is mounted at a time.
	const canvas = page.getByTestId('label-preview-canvas');
	await canvas.waitFor({ state: 'visible', timeout });
	await expect(canvas).toHaveAttribute('data-render-status', 'stable', { timeout });
}
