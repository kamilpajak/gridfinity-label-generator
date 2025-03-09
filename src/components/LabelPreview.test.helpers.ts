// This file contains helper functions for testing the LabelPreview component
// Instead of using JSX, we'll use simple functions that return objects with the expected values

/**
 * Helper function to calculate dimensions for a label
 * @param labelWidth The width of the label in mm
 * @returns An object with the calculated dimensions
 */
export function calculateDimensions(labelWidth: number) {
  return {
    tapeSize: {
      width: labelWidth,
      height: 12,
      text: `${labelWidth}mm × 12mm (tape size)`
    },
    printableArea: {
      width: labelWidth - 4,
      height: 10,
      text: `${labelWidth - 4}mm × 10mm (printable area)`
    }
  };
}

/**
 * Helper function to calculate margin percentages
 * @param labelWidth The width of the label in mm
 * @returns An object with the calculated margin percentages
 */
export function calculateMargins(labelWidth: number) {
  const topBottomMarginPercent = (1 / 12) * 100; // 1mm out of 12mm height = 8.33%
  const leftRightMarginPercent = (2 / labelWidth) * 100; // 2mm out of labelWidth
  
  return {
    top: topBottomMarginPercent,
    bottom: topBottomMarginPercent,
    left: leftRightMarginPercent,
    right: leftRightMarginPercent
  };
}

/**
 * Helper function to generate the alt text for the label image
 * @param labelWidth The width of the label in mm
 * @returns The alt text for the label image
 */
export function generateAltText(labelWidth: number) {
  return `Generated label with dimensions ${labelWidth - 4}mm × 10mm`;
}

/**
 * Helper function to get the aspect ratio for the tape container
 * @param labelWidth The width of the label in mm
 * @returns The aspect ratio string
 */
export function getAspectRatio(labelWidth: number) {
  return `${labelWidth} / 12`;
}

/**
 * Helper function to get the placeholder text
 * @returns The placeholder text
 */
export function getPlaceholderText() {
  return "Fill out the form to generate a label";
}
