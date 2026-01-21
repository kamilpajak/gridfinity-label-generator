/**
 * Canvas geometry calculations for label preview
 * These values must match the actual canvas rendering in the application
 */

/** Canvas transform offset in mm */
export const CANVAS_TRANSLATE_MM = {
	x: 2,
	y: 1
} as const;

/** QR code dimensions in mm */
export const QR_CODE_SIZE_MM = 10;

/** Margin from canvas edge in mm */
export const CANVAS_MARGIN_MM = 2;

/** Gray guideline color RGB values (matches label-preview.svelte) */
export const GUIDELINE_COLOR_RGB = { r: 243, g: 244, b: 246 } as const;

/** Minimum percentage of non-white pixels required to detect QR code presence */
export const QR_DETECTION_THRESHOLD = 0.3;
