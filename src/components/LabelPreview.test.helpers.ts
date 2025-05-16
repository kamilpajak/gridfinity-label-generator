// This file contains helper functions for testing the LabelPreview component
// Instead of using JSX, we'll use simple functions that return objects with the expected values

/**
 * Helper function to check if QR code should be displayed
 * @param showQrCode Boolean indicating if QR code should be shown
 * @returns Object with QR code display information
 */
export function checkQrCodeDisplay(showQrCode: boolean) {
  return {
    isVisible: showQrCode,
    position: 'right side of the label',
    dimensions: '10mm × 10mm',
  }
}

/**
 * Helper function to check if label elements overlap
 * @param labelWidth The width of the label in mm
 * @param showImage Boolean indicating if image is shown
 * @param showQrCode Boolean indicating if QR code is shown
 * @param labelHeight The height of the label in mm (defaults to 10)
 * @returns Object with layout validation information
 */
export function validateLabelLayout(
  labelWidth: number,
  showImage: boolean,
  showQrCode: boolean,
  labelHeight: number = 10
) {
  // QR code has highest priority - position it first if enabled
  // QR code height is equal to the label height, but max 10mm
  const qrCodeSize = showQrCode ? Math.min(labelHeight, 10) : 0
  const qrCodeX = showQrCode ? labelWidth - qrCodeSize : 0 // QR code at right edge

  // Calculate available width for image and text (with 1mm gap between text and QR code)
  const gapBetweenTextAndQrMm = qrCodeSize > 0 ? 1 : 0 // 1mm gap if QR code is present
  const availableWidthForImageAndText =
    qrCodeSize > 0 ? qrCodeX - gapBetweenTextAndQrMm : labelWidth

  // Calculate image width if enabled
  // Image width is proportional to label height, but capped at 40% of available width
  const maxImageWidth = Math.min(availableWidthForImageAndText * 0.4, labelHeight)
  const imageWidth = showImage ? maxImageWidth : 0
  const gap = 2 // Gap between elements in mm

  // Calculate text area position and width
  const textX = showImage ? imageWidth + gap : 0
  const textWidth = availableWidthForImageAndText - textX

  // Check if there's enough space for text (at least 10mm)
  const hasEnoughTextSpace = textWidth >= 10

  // Check if elements overlap
  const elementsOverlap = textWidth < 0

  return {
    imageWidth,
    qrCodeWidth: qrCodeSize,
    labelHeight,
    textAreaWidth: textWidth,
    hasEnoughTextSpace,
    elementsOverlap,
    layout: {
      image: showImage ? { x: 0, width: imageWidth } : null,
      text: { x: textX, width: textWidth },
      qrCode: showQrCode ? { x: qrCodeX, width: qrCodeSize } : null,
    },
  }
}

/**
 * Helper function to calculate dimensions for a label
 * @param labelWidth The width of the label in mm
 * @param labelHeight The height of the label in mm (defaults to 10)
 * @returns An object with the calculated dimensions
 */
export function calculateDimensions(labelWidth: number, labelHeight: number = 10) {
  return {
    tapeSize: {
      width: labelWidth,
      height: labelHeight + 2, // Tape is 2mm taller than printable area
      text: `${labelWidth}mm × ${labelHeight + 2}mm (tape size)`,
    },
    printableArea: {
      width: labelWidth - 4,
      height: labelHeight,
      text: `${labelWidth - 4}mm × ${labelHeight}mm (printable area)`,
    },
  }
}

/**
 * Helper function to calculate margin percentages
 * @param labelWidth The width of the label in mm
 * @param labelHeight The height of the label in mm (defaults to 10)
 * @returns An object with the calculated margin percentages
 */
export function calculateMargins(labelWidth: number, labelHeight: number = 10) {
  const topBottomMarginPercent = (1 / (labelHeight + 2)) * 100 // 1mm out of labelHeight+2
  const leftRightMarginPercent = (2 / labelWidth) * 100 // 2mm out of labelWidth

  return {
    top: topBottomMarginPercent,
    bottom: topBottomMarginPercent,
    left: leftRightMarginPercent,
    right: leftRightMarginPercent,
  }
}

/**
 * Helper function to generate the alt text for the label image
 * @param labelWidth The width of the label in mm
 * @param labelHeight The height of the label in mm (defaults to 10)
 * @returns The alt text for the label image
 */
export function generateAltText(labelWidth: number, labelHeight: number = 10) {
  return `Generated label with dimensions ${labelWidth - 4}mm × ${labelHeight}mm`
}

/**
 * Helper function to get the aspect ratio for the tape container
 * @param labelWidth The width of the label in mm
 * @param labelHeight The height of the label in mm (defaults to 10)
 * @returns The aspect ratio string
 */
export function getAspectRatio(labelWidth: number, labelHeight: number = 10) {
  return `${labelWidth} / ${labelHeight + 2}`
}

/**
 * Helper function to get the placeholder text
 * @returns The placeholder text
 */
export function getPlaceholderText() {
  return 'Fill out the form to generate a label'
}
