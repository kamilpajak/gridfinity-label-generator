/**
 * Text Measurement Utilities
 *
 * Provides functions for measuring text dimensions using Canvas API
 * to optimize font sizes in the constraint solver
 */

/**
 * Measures the width of text using Canvas API
 * @param text - The text to measure
 * @param fontFamily - Font family name (e.g., 'Noto Sans', 'Oswald')
 * @param fontSize - Font size in pixels
 * @param fontWeight - Font weight (e.g., '300', '900', 'normal', 'bold')
 * @returns Width of the text in pixels
 */
export function measureText(
	text: string,
	fontFamily: string,
	fontSize: number,
	fontWeight: string = 'normal'
): number {
	if (!text) return 0;

	// Create off-screen canvas for measurement
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		console.warn('Could not get canvas context for text measurement');
		// Fallback: rough estimation based on character count
		return text.length * fontSize * 0.6;
	}

	// Set font properties
	ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

	// Measure and return text width
	return ctx.measureText(text).width;
}

/**
 * Estimates text height based on font size
 * SVG doesn't provide easy height measurement, so we use approximations
 * @param fontSize - Font size in pixels
 * @returns Estimated height including ascent and descent
 */
export function estimateTextHeight(fontSize: number): number {
	// Approximate line height as 1.2 times font size
	return fontSize * 1.2;
}

/**
 * Calculates optimal font size to fit text within given width
 * Uses binary search for efficiency
 * @param text - The text to fit
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight
 * @param maxWidth - Maximum available width
 * @param minSize - Minimum allowed font size
 * @param maxSize - Maximum allowed font size
 * @returns Optimal font size that fits within constraints
 */
export function calculateOptimalFontSize(
	text: string,
	fontFamily: string,
	fontWeight: string,
	maxWidth: number,
	minSize: number,
	maxSize: number
): number {
	if (!text) return maxSize;

	// Binary search for optimal font size
	let low = minSize;
	let high = maxSize;
	let optimal = minSize;

	// Use full available width
	const targetWidth = maxWidth;

	while (high - low > 0.1) {
		const mid = (low + high) / 2;
		const width = measureText(text, fontFamily, mid, fontWeight);

		if (width <= targetWidth) {
			optimal = mid;
			low = mid;
		} else {
			high = mid;
		}
	}

	return optimal;
}
