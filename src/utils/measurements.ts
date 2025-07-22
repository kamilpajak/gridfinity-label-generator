/**
 * @fileoverview Measurement utilities and validation functions
 * @module utils/measurements
 */

/**
 * Converts millimeters to pixels using 360 DPI conversion factor
 * @param {number} mm - Value in millimeters
 * @returns {number} Value in pixels
 * @example
 * const pixels = mmToPx(10); // Returns 141.73228346
 */
export const mmToPx = (mm: number): number => mm * 14.173228346 // 360 DPI conversion

/**
 * Configuration for numeric validation
 * @typedef {Object} ValidationConfig
 * @property {number} defaultValue - Default value when input is invalid
 * @property {number} min - Minimum allowed value
 * @property {number} max - Maximum allowed value
 * @property {number[]} [allowedValues] - Array of allowed discrete values
 * @property {(value: number) => number} [transform] - Optional transform function
 */
interface ValidationConfig {
  defaultValue: number
  min?: number
  max?: number
  allowedValues?: number[]
  transform?: (value: number) => number
}

/**
 * Generic validation function for numeric inputs
 * @param {string | number} value - Input value to validate
 * @param {ValidationConfig} config - Validation configuration
 * @returns {number} Validated and constrained value
 * @example
 * // Range validation
 * const width = validateNumeric('50', { defaultValue: 55, min: 37, max: 100 });
 *
 * @example
 * // Discrete values validation
 * const height = validateNumeric('15', {
 *   defaultValue: 12,
 *   allowedValues: [9, 12, 18, 24]
 * });
 */
export function validateNumeric(value: string | number, config: ValidationConfig): number {
  const { defaultValue, min, max, allowedValues, transform } = config

  // Parse the value
  let numValue = typeof value === 'string' ? parseFloat(value) : value

  // Check for NaN
  if (isNaN(numValue)) {
    return defaultValue
  }

  // Apply transform if provided
  if (transform) {
    numValue = transform(numValue)
  }

  // Handle discrete allowed values
  if (allowedValues && allowedValues.length > 0) {
    // Find the closest allowed value
    return allowedValues.reduce(
      (prev, curr) => (Math.abs(curr - numValue) < Math.abs(prev - numValue) ? curr : prev),
      allowedValues[0]
    )
  }

  // Apply min/max constraints
  if (min !== undefined && numValue < min) {
    numValue = min
  }
  if (max !== undefined && numValue > max) {
    numValue = max
  }

  return numValue
}

/**
 * Validates label width with constraints
 * @param {string | number} value - Width value to validate
 * @returns {number} Valid width between 37mm and 100mm (default: 55mm)
 * @example
 * const width = validateWidth('120'); // Returns 100 (clamped to max)
 * const width2 = validateWidth('abc'); // Returns 55 (default)
 */
export const validateWidth = (value: string | number): number => {
  return validateNumeric(value, {
    defaultValue: 55,
    min: 37,
    max: 100,
    transform: v => parseInt(v.toString()),
  })
}

/**
 * Validates label height to allowed discrete values
 * @param {string | number} value - Height value to validate
 * @returns {number} Closest allowed height value (9, 12, 18, or 24mm)
 * @example
 * const height = validateHeight('10'); // Returns 9 (closest allowed value)
 * const height2 = validateHeight('15'); // Returns 12 (closest allowed value)
 */
export const validateHeight = (value: string | number): number => {
  return validateNumeric(value, {
    defaultValue: 12,
    allowedValues: [9, 12, 18, 24],
  })
}

/**
 * Validates text size percentage
 * @param {string | number} value - Text size percentage to validate
 * @returns {number} Valid text size between 50% and 150% (default: 100%)
 * @example
 * const size = validateTextSize('125.7'); // Returns 126 (rounded)
 * const size2 = validateTextSize('200'); // Returns 150 (clamped to max)
 */
export const validateTextSize = (value: string | number): number => {
  return validateNumeric(value, {
    defaultValue: 100,
    min: 50,
    max: 150,
    transform: Math.round,
  })
}

/**
 * Dynamically calculates font size to achieve desired text height
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} desiredHeight - Desired text height in pixels
 * @param {string} text - Text to measure
 * @param {string} fontFamily - Font family name
 * @returns {number} Calculated font size in pixels
 * @example
 * const fontSize = computeDynamicFontSize(ctx, 20, 'Hello', 'Arial');
 * ctx.font = `${fontSize}px Arial`;
 */
export function computeDynamicFontSize(
  ctx: CanvasRenderingContext2D,
  desiredHeight: number,
  text: string,
  fontFamily: string
): number {
  let fontSize = desiredHeight
  ctx.font = `900 ${fontSize}px "${fontFamily}", sans-serif`
  const metrics = ctx.measureText(text)

  // Adjust font size to match desired height
  const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  if (actualHeight !== 0) {
    fontSize = (desiredHeight / actualHeight) * fontSize
  }

  return Math.round(fontSize)
}
