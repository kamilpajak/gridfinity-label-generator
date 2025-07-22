/**
 * @fileoverview Helper functions for testing the LabelPreview component
 * @module test-utils/label-preview.helpers
 */

import { QR_CODE } from './constants'
import {
  getPrintableArea,
  getMarginPercentages,
  getTapeSize,
  LABEL_MARGINS,
} from '~/utils/labelDimensions'

/**
 * QR code display information
 * @typedef {Object} QrCodeDisplayInfo
 * @property {boolean} isVisible - Whether QR code is visible
 * @property {string} position - Position description
 * @property {string} dimensions - Dimensions description
 */
interface QrCodeDisplayInfo {
  isVisible: boolean
  position: string
  dimensions: string
}

/**
 * Label layout information
 * @typedef {Object} LabelLayoutInfo
 * @property {number} imageWidth - Width of the image in mm
 * @property {number} qrCodeWidth - Width of the QR code in mm
 * @property {number} labelHeight - Height of the label in mm
 * @property {number} textAreaWidth - Width of the text area in mm
 * @property {boolean} hasEnoughTextSpace - Whether there's enough space for text
 * @property {boolean} elementsOverlap - Whether elements overlap
 * @property {Object} layout - Layout positions and dimensions
 */
interface LabelLayoutInfo {
  imageWidth: number
  qrCodeWidth: number
  labelHeight: number
  textAreaWidth: number
  hasEnoughTextSpace: boolean
  elementsOverlap: boolean
  layout: {
    image: { x: number; width: number } | null
    text: { x: number; width: number }
    qrCode: { x: number; width: number } | null
  }
}

/**
 * Label dimensions information
 * @typedef {Object} LabelDimensionsInfo
 * @property {Object} tapeSize - Tape size dimensions
 * @property {Object} printableArea - Printable area dimensions
 */
interface LabelDimensionsInfo {
  tapeSize: {
    width: number
    height: number
    text: string
  }
  printableArea: {
    width: number
    height: number
    text: string
  }
}

/**
 * Margin percentages
 * @typedef {Object} MarginPercentages
 * @property {number} top - Top margin percentage
 * @property {number} bottom - Bottom margin percentage
 * @property {number} left - Left margin percentage
 * @property {number} right - Right margin percentage
 */
interface MarginPercentages {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Check if QR code should be displayed
 * @param {boolean} showQrCode - Whether QR code should be shown
 * @returns {QrCodeDisplayInfo} QR code display information
 */
export function checkQrCodeDisplay(showQrCode: boolean): QrCodeDisplayInfo {
  return {
    isVisible: showQrCode,
    position: 'right side of the label',
    dimensions: `${QR_CODE.MAX_SIZE}mm × ${QR_CODE.MAX_SIZE}mm`,
  }
}

/**
 * Validate label layout and check for overlapping elements
 * @param {number} labelWidth - The width of the label in mm
 * @param {boolean} showImage - Whether image is shown
 * @param {boolean} showQrCode - Whether QR code is shown
 * @param {number} [labelHeight=10] - The height of the label in mm
 * @returns {LabelLayoutInfo} Layout validation information
 */
export function validateLabelLayout(
  labelWidth: number,
  showImage: boolean,
  showQrCode: boolean,
  labelHeight: number = 10
): LabelLayoutInfo {
  // QR code has highest priority - position it first if enabled
  // QR code height is equal to the label height, but max 10mm
  const qrCodeSize = showQrCode ? Math.min(labelHeight, QR_CODE.MAX_SIZE) : 0
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
 * Calculate dimensions for a label
 * @param {number} labelWidth - The width of the label in mm
 * @param {number} [labelHeight=10] - The height of the label in mm (printable area)
 * @returns {LabelDimensionsInfo} Calculated dimensions
 */
export function calculateDimensions(
  labelWidth: number,
  labelHeight: number = 10
): LabelDimensionsInfo {
  const printableArea = getPrintableArea(labelWidth, labelHeight + LABEL_MARGINS.VERTICAL)
  const tapeSize = getTapeSize(labelWidth, labelHeight)

  return {
    tapeSize: {
      width: tapeSize.width,
      height: tapeSize.height,
      text: `${tapeSize.width}mm × ${tapeSize.height}mm (tape size)`,
    },
    printableArea: {
      width: printableArea.width,
      height: printableArea.height,
      text: `${printableArea.width}mm × ${printableArea.height}mm (printable area)`,
    },
  }
}

/**
 * Calculate margin percentages
 * @param {number} labelWidth - The width of the label in mm
 * @param {number} [labelHeight=10] - The height of the label in mm (printable area)
 * @returns {MarginPercentages} Calculated margin percentages
 */
export function calculateMargins(labelWidth: number, labelHeight: number = 10): MarginPercentages {
  const margins = getMarginPercentages(labelWidth, labelHeight)

  return {
    top: margins.topBottom,
    bottom: margins.topBottom,
    left: margins.leftRight,
    right: margins.leftRight,
  }
}

/**
 * Generate the alt text for the label image
 * @param {number} labelWidth - The width of the label in mm
 * @param {number} [labelHeight=10] - The height of the label in mm (printable area)
 * @returns {string} Alt text for the label image
 */
export function generateAltText(labelWidth: number, labelHeight: number = 10): string {
  const printableArea = getPrintableArea(labelWidth, labelHeight + LABEL_MARGINS.VERTICAL)
  return `Generated label with dimensions ${printableArea.width}mm × ${labelHeight}mm`
}

/**
 * Get the aspect ratio for the tape container
 * @param {number} labelWidth - The width of the label in mm
 * @param {number} [labelHeight=10] - The height of the label in mm (printable area)
 * @returns {string} Aspect ratio string
 */
export function getAspectRatio(labelWidth: number, labelHeight: number = 10): string {
  const tapeSize = getTapeSize(labelWidth, labelHeight)
  return `${tapeSize.width} / ${tapeSize.height}`
}

/**
 * Get the placeholder text
 * @returns {string} Placeholder text
 */
export function getPlaceholderText(): string {
  return 'Fill out the form to generate a label'
}

/**
 * Constants for layout validation
 * @namespace
 */
export const LAYOUT_CONSTANTS = {
  /** Minimum text area width in mm */
  MIN_TEXT_WIDTH: 10,
  /** Gap between image and text in mm */
  IMAGE_TEXT_GAP: 2,
  /** Gap between text and QR code in mm */
  TEXT_QR_GAP: 1,
  /** Maximum image width as percentage of available space */
  MAX_IMAGE_WIDTH_RATIO: 0.4,
  /** Minimum viable label width */
  MIN_VIABLE_WIDTH: 40,
} as const
