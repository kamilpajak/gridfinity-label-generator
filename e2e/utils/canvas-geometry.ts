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
