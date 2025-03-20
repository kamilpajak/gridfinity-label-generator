/**
 * Utility functions for print calibration to handle discrepancies between
 * specified dimensions and actual printed dimensions.
 */

/**
 * Calculates the width to set in the application to achieve the desired printed width.
 * This is useful when the printer consistently scales the output by a certain factor.
 * 
 * @param desiredPrintedWidthMm The width you want the final printed label to be (in mm)
 * @param scaleFactor The scaling factor applied during printing (default: 1.0, no scaling)
 * @returns The width to set in the application (in mm)
 * 
 * @example
 * // With default scaling factor of 1.0 (no scaling)
 * const widthToSet = calculateWidthForPrinting(54); // Returns 54mm
 */
export function calculateWidthForPrinting(
  desiredPrintedWidthMm: number,
  scaleFactor: number = 1.0 // No scaling
): number {
  return desiredPrintedWidthMm / scaleFactor;
}

/**
 * Calculates the expected printed width based on the width set in the application.
 * This is useful to predict what the final printed dimensions will be.
 * 
 * @param setWidthMm The width set in the application (in mm)
 * @param scaleFactor The scaling factor applied during printing (default: 1.0, no scaling)
 * @returns The expected printed width (in mm)
 * 
 * @example
 * // With default scaling factor of 1.0 (no scaling)
 * const expectedPrintedWidth = calculateExpectedPrintedWidth(54); // Returns 54mm
 */
export function calculateExpectedPrintedWidth(
  setWidthMm: number,
  scaleFactor: number = 1.0 // No scaling
): number {
  return setWidthMm * scaleFactor;
}

/**
 * Calculates the scaling factor based on the set width and the resulting printed width.
 * This is useful for calibrating the system based on actual measurements.
 * 
 * @param setWidthMm The width set in the application (in mm)
 * @param actualPrintedWidthMm The actual width of the printed label (in mm)
 * @returns The scaling factor (ratio of printed width to set width)
 * 
 * @example
 * // If setting width to 54mm results in a 58mm printed label
 * const scaleFactor = calculateScalingFactor(54, 58); // Returns 1.074
 */
export function calculateScalingFactor(
  setWidthMm: number,
  actualPrintedWidthMm: number
): number {
  return actualPrintedWidthMm / setWidthMm;
}
