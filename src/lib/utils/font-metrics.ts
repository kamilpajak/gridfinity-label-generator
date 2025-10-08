/**
 * Font Metrics Utilities
 *
 * Provides functions for measuring actual font metrics (ascent/descent)
 * using Canvas API to ensure accurate text positioning in label layouts.
 */

export interface FontMetrics {
	/** Ratio of ascent to font size (e.g., 0.724 for Noto Sans 900) */
	ascent: number;
	/** Ratio of descent to font size (e.g., 0.010 for Noto Sans 900) */
	descent: number;
}

/**
 * Measures actual font metrics from Canvas API
 * @param fontFamily - Font family name (e.g., 'Noto Sans', 'Oswald')
 * @param fontWeight - Font weight (e.g., '300', '900')
 * @returns FontMetrics with ascent/descent ratios relative to font size
 */
export async function getFontMetrics(fontFamily: string, fontWeight: string): Promise<FontMetrics> {
	// SSR guard: Return fallback metrics when running server-side
	if (typeof document === 'undefined') {
		return {
			ascent: 0.75,
			descent: 0.25
		};
	}

	// Ensure font is loaded before measuring
	try {
		await document.fonts.load(`${fontWeight} 100px "${fontFamily}"`);
	} catch (e) {
		console.warn('Font loading failed:', e);
	}

	// Create off-screen canvas for measurement
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		console.warn('Could not get canvas context for font metrics measurement');
		// Fallback to conservative estimates
		return {
			ascent: 0.75,
			descent: 0.25
		};
	}

	// Set font properties
	ctx.font = `${fontWeight} 100px "${fontFamily}"`;
	ctx.textBaseline = 'alphabetic';

	// Measure using representative text for each font
	// Primary font (Noto Sans): typical hardware text like "M10"
	// Secondary font (Oswald): typical standard text like "DIN 931"
	let sampleText = 'M10'; // Default: numbers and capitals (no descenders)

	if (fontFamily === 'Oswald') {
		sampleText = 'DIN 931'; // Actual text we render
	}

	const metrics = ctx.measureText(sampleText);

	// Return ratios relative to font size (100px)
	return {
		ascent: metrics.actualBoundingBoxAscent / 100,
		descent: metrics.actualBoundingBoxDescent / 100
	};
}

/**
 * Cache for font metrics to avoid repeated measurements
 */
const metricsCache = new Map<string, FontMetrics>();

/**
 * Gets font metrics with caching
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight
 * @returns Cached or freshly measured FontMetrics
 */
export async function getCachedFontMetrics(
	fontFamily: string,
	fontWeight: string
): Promise<FontMetrics> {
	const cacheKey = `${fontFamily}-${fontWeight}`;

	if (metricsCache.has(cacheKey)) {
		return metricsCache.get(cacheKey)!;
	}

	const metrics = await getFontMetrics(fontFamily, fontWeight);
	metricsCache.set(cacheKey, metrics);
	return metrics;
}

/**
 * Clears the font metrics cache
 * Useful for testing or when fonts change dynamically
 */
export function clearFontMetricsCache(): void {
	metricsCache.clear();
}

/**
 * Measures the cap-height ratio of a font
 * Cap-height is the height of capital letters (e.g., 'M')
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight
 * @returns Cap-height as ratio of font size (e.g., 0.724 means cap-height is 72.4% of font size)
 */
export function measureCapHeight(fontFamily: string, fontWeight: string): number {
	// SSR guard: Return fallback cap-height when running server-side
	if (typeof document === 'undefined') {
		return 0.7;
	}

	// Create off-screen canvas for measurement
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		console.warn('Could not get canvas context for cap-height measurement');
		// Fallback to approximate cap-height ratio
		return 0.7;
	}

	// Set font at 100px for accurate measurement
	ctx.font = `${fontWeight} 100px "${fontFamily}"`;
	ctx.textBaseline = 'alphabetic';

	// Measure capital 'M' which represents cap-height
	const metrics = ctx.measureText('M');

	// Return ratio relative to font size
	return metrics.actualBoundingBoxAscent / 100;
}

/**
 * Cache for cap-height measurements
 */
const capHeightCache = new Map<string, number>();

/**
 * Gets cap-height with caching
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight
 * @returns Cached or freshly measured cap-height ratio
 */
export function getCachedCapHeight(fontFamily: string, fontWeight: string): number {
	const cacheKey = `${fontFamily}-${fontWeight}`;

	if (capHeightCache.has(cacheKey)) {
		return capHeightCache.get(cacheKey)!;
	}

	const capHeight = measureCapHeight(fontFamily, fontWeight);
	capHeightCache.set(cacheKey, capHeight);
	return capHeight;
}

/**
 * Clears the cap-height cache
 */
export function clearCapHeightCache(): void {
	capHeightCache.clear();
}
