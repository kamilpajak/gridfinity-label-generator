/**
 * @fileoverview Centralized test constants to replace magic numbers across test files
 * @module test-utils/constants
 */

/**
 * Label dimension constants (in mm)
 * @namespace
 */
export const LABEL_DIMENSIONS = {
  /** Standard label widths available in the application */
  WIDTHS: {
    DEFAULT: 54,
    MIN: 37,
    MAX: 100,
  },
  /** Standard label heights available in the application */
  HEIGHTS: {
    DEFAULT: 12,
    SMALL: 9,
    MEDIUM: 12,
    LARGE: 18,
    EXTRA_LARGE: 24,
    ALLOWED_VALUES: [9, 12, 18, 24] as const,
  },
  /** Label margins applied during rendering */
  MARGINS: {
    /** Horizontal margin (2mm on each side) */
    WIDTH: 4,
    /** Vertical margin (1mm on top and bottom) */
    HEIGHT: 2,
  },
} as const

/**
 * Text size constants for label rendering
 * @namespace
 */
export const TEXT_SIZES = {
  /** Default text size percentages */
  DEFAULT: {
    TOP: 75,
    BOTTOM: 75,
  },
  /** Minimum text size percentage */
  MIN: 50,
  /** Maximum text size percentage */
  MAX: 150,
} as const

/**
 * QR code dimension constants
 * @namespace
 */
export const QR_CODE = {
  /** Maximum QR code size in mm */
  MAX_SIZE: 10,
  /** Default QR code data URL for tests */
  DEFAULT_DATA_URL: 'mock-qr-code-data-url',
} as const

/**
 * Canvas rendering constants
 * @namespace
 */
export const CANVAS = {
  /** Default canvas data URL for tests */
  DEFAULT_DATA_URL: 'mock-data-url',
  /** Text measurement approximations */
  TEXT_METRICS: {
    /** Average character width in pixels */
    CHAR_WIDTH: 10,
    /** Text ascent height */
    ASCENT: 10,
    /** Text descent height */
    DESCENT: 5,
    /** Font bounding box ascent */
    FONT_ASCENT: 12,
    /** Font bounding box descent */
    FONT_DESCENT: 6,
  },
} as const

/**
 * Print calibration test constants
 * @namespace
 */
export const PRINT_CALIBRATION = {
  /** Common test width values */
  TEST_WIDTHS: {
    STANDARD: 54,
    LARGE: 100,
    SMALL: 1,
    VERY_LARGE: 1000,
  },
  /** Common scaling factors for tests */
  SCALING_FACTORS: {
    DEFAULT: 1.0,
    SMALL: 1.074,
    MEDIUM: 1.1,
    LARGE: 1.2,
  },
  /** Expected calculation results */
  EXPECTED_VALUES: {
    /** Expected width to set for 54mm with 1.1 scaling */
    WIDTH_54_SCALE_1_1: 49.09,
    /** Expected width to set for 100mm with 1.2 scaling */
    WIDTH_100_SCALE_1_2: 83.33,
    /** Expected printed width for 49.09mm set with 1.1 scaling */
    PRINTED_49_09_SCALE_1_1: 54,
    /** Expected printed width for 83.33mm set with 1.2 scaling */
    PRINTED_83_33_SCALE_1_2: 100,
  },
} as const

/**
 * Hardware type test constants
 * @namespace
 */
export const HARDWARE_TYPES = {
  /** Common thread sizes for testing */
  THREAD_SIZES: {
    METRIC: ['M5', 'M6', 'M8'],
    IMPERIAL: ['1/4-20', '5/16-18', '3/8-16'],
  },
  /** Common lengths for testing */
  LENGTHS: {
    METRIC: ['20', '25', '30'],
    IMPERIAL: ['1/2', '3/4', '1'],
  },
  /** Common standards for testing */
  STANDARDS: {
    SCREW: ['DIN 11014', 'DIN 912', 'ISO 4762'],
    NUT: ['DIN 934', 'ISO 4032'],
    WASHER: ['DIN 125', 'ISO 7089'],
  },
} as const

/**
 * Validation test constants
 * @namespace
 */
export const VALIDATION = {
  /** Common invalid input values for validation tests */
  INVALID_INPUTS: [NaN, 'abc', null, undefined, '', '  ', 'invalid'],
  /** Common numeric test values */
  NUMERIC_VALUES: {
    BELOW_MIN: [-100, -10, 0],
    ABOVE_MAX: [150, 200, 1000],
    EDGE_CASES: [0.1, 0.5, 0.9, 99.1, 99.5, 99.9],
  },
  /** Rounding test cases */
  ROUNDING: {
    /** Values that should round down */
    ROUND_DOWN: [75.4, 50.1, 99.49],
    /** Values that should round up */
    ROUND_UP: [75.5, 50.9, 99.51],
  },
} as const

/**
 * Test timing constants
 * @namespace
 */
export const TIMING = {
  /** Timeout values for async operations */
  TIMEOUTS: {
    /** Short timeout for quick operations */
    SHORT: 100,
    /** Medium timeout for standard operations */
    MEDIUM: 1000,
    /** Long timeout for complex operations */
    LONG: 5000,
  },
} as const

/**
 * Type guard to check if a value is in the allowed heights array
 * @param {number} value - The value to check
 * @returns {boolean} True if the value is an allowed height
 */
export function isAllowedHeight(
  value: number
): value is (typeof LABEL_DIMENSIONS.HEIGHTS.ALLOWED_VALUES)[number] {
  return (LABEL_DIMENSIONS.HEIGHTS.ALLOWED_VALUES as readonly number[]).includes(value)
}

/**
 * Calculate printable area from label dimensions
 * @param {number} width - Label width in mm
 * @param {number} height - Label height in mm
 * @returns {{ width: number, height: number }} Printable area dimensions
 */
export function getPrintableArea(width: number, height: number): { width: number; height: number } {
  return {
    width: width - LABEL_DIMENSIONS.MARGINS.WIDTH,
    height: height - LABEL_DIMENSIONS.MARGINS.HEIGHT,
  }
}
