import { type Locator } from '@playwright/test';

/**
 * Slider interaction helpers for e2e tests.
 *
 * These helpers simulate real user interactions (clicks at calculated positions)
 * rather than using DOM manipulation via evaluate(). This ensures:
 * - Svelte reactivity is properly triggered
 * - Tests match actual user behavior
 * - No flaky tests due to framework-specific event handling
 */

/**
 * Set slider value by simulating user click at the correct position.
 *
 * @param slider - Playwright locator for the slider element (role="slider")
 * @param value - Target value to set
 * @param options - Optional min/max overrides (defaults read from aria attributes)
 *
 * @example
 * ```typescript
 * const widthSlider = page.getByTestId('label-width-slider');
 * await setSliderValue(widthSlider, 50);
 * ```
 */
export async function setSliderValue(
	slider: Locator,
	value: number,
	options: { min?: number; max?: number } = {}
): Promise<void> {
	const boundingBox = await slider.boundingBox();
	if (!boundingBox) {
		throw new Error('Slider element not found or not visible');
	}

	// Read min/max from aria attributes or use provided options
	const min = options.min ?? (Number(await slider.getAttribute('aria-valuemin')) || 0);
	const max = options.max ?? (Number(await slider.getAttribute('aria-valuemax')) || 100);

	// Clamp value to valid range
	const clampedValue = Math.max(min, Math.min(max, value));

	// Calculate click position as percentage of slider width.
	// Inset the target by 1px from each edge so extreme values (0% / 100%) land
	// squarely inside the slider track instead of on the exact border, where
	// sub-pixel rounding can send the click to an ancestor and get intercepted.
	const percentage = (clampedValue - min) / (max - min);
	const targetX = Math.min(Math.max(boundingBox.width * percentage, 1), boundingBox.width - 1);

	await slider.click({
		position: { x: targetX, y: boundingBox.height / 2 }
	});

	// Wait for UI to process the click (minimal non-blocking wait)
	await slider.page().evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

/**
 * Get current slider value from aria-valuenow attribute.
 *
 * @param slider - Playwright locator for the slider element
 * @returns Current slider value
 */
export async function getSliderValue(slider: Locator): Promise<number> {
	const value = await slider.getAttribute('aria-valuenow');
	return value ? Number(value) : 0;
}
