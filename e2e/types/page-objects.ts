/**
 * Shared types for E2E Page Objects
 */

/** Label tape height options */
export type LabelSize = '9mm' | '12mm';

/** Label mode (fastener with hardware selection vs general item) */
export type LabelMode = 'fastener' | 'general';

/** Unit system for measurements */
export type UnitSystem = 'metric' | 'imperial';

/** Options for creating a complete label */
export interface CreateLabelOptions {
	size: LabelSize;
	primaryText: string;
	secondaryText: string;
	hardware?: string;
	qrUrl?: string;
	unit?: UnitSystem;
	mode?: LabelMode;
}

/** Expected canvas dimensions at ~180 DPI preview resolution */
export const EXPECTED_CANVAS_SIZES: Record<LabelSize, { width: number; height: number }> = {
	'9mm': { width: 354, height: 118 }, // ~50x9mm at ~180 DPI
	'12mm': { width: 248, height: 141 } // ~35x12mm at ~180 DPI
} as const;

/** Tolerance in pixels for dimension comparison (accounts for DPI variance) */
export const DIMENSION_TOLERANCE_PX = 10;

/** Label width slider range (35-100mm) */
export const LABEL_WIDTH_SLIDER_RANGE = {
	min: 35,
	max: 100
} as const;
