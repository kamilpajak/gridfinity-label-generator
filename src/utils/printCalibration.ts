/**
 * Utility functions for print calibration to handle discrepancies between
 * specified dimensions and actual printed dimensions.
 */

/**
 * Calculates the width to set in the application to achieve the desired printed width.
 * This is useful when the printer consistently scales the output by a certain factor.
 * 
 * @param desiredPrintedWidthMm The width you want the final printed label to be (in mm)
 * @param scaleFactor The scaling factor applied during printing (default: 1.074 based on 54mm → 58mm)
 * @returns The width to set in the application (in mm)
 * 
 * @example
 * // If setting width to 54mm results in a 58mm printed label (scaling factor = 58/54 = 1.074)
 * // To get a 54mm printed label, you should set the width to:
 * const widthToSet = calculateWidthForPrinting(54); // Returns ~50.3mm
 */
export function calculateWidthForPrinting(
  desiredPrintedWidthMm: number,
  scaleFactor: number = 1.074 // Default based on 54mm → 58mm
): number {
  return desiredPrintedWidthMm / scaleFactor;
}

/**
 * Calculates the expected printed width based on the width set in the application.
 * This is useful to predict what the final printed dimensions will be.
 * 
 * @param setWidthMm The width set in the application (in mm)
 * @param scaleFactor The scaling factor applied during printing (default: 1.074 based on 54mm → 58mm)
 * @returns The expected printed width (in mm)
 * 
 * @example
 * // If setting width to 54mm results in a 58mm printed label
 * const expectedPrintedWidth = calculateExpectedPrintedWidth(54); // Returns ~58mm
 */
export function calculateExpectedPrintedWidth(
  setWidthMm: number,
  scaleFactor: number = 1.074 // Default based on 54mm → 58mm
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
