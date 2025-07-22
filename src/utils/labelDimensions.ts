/**
 * @fileoverview Centralized module for label dimension calculations
 * @module utils/labelDimensions
 */

import { mmToPx } from './measurements'
import { logger } from '~/config/logging'

/**
 * Label margin constants in millimeters
 * @namespace
 */
export const LABEL_MARGINS = {
  /** Total horizontal margin (2mm on each side) */
  HORIZONTAL: 4,
  /** Total vertical margin (1mm on top and bottom) */
  VERTICAL: 2,
  /** Single side horizontal margin */
  HORIZONTAL_SINGLE: 2,
  /** Single side vertical margin */
  VERTICAL_SINGLE: 1,
} as const

/**
 * Label dimensions interface
 * @interface LabelDimensions
 */
export interface LabelDimensions {
  printableWidthMm: number
  printableHeightMm: number
  printableWidthPx: number
  printableHeightPx: number
  conversionFactor: number
}

/**
 * Calculate printable area from label dimensions
 * @param {number} labelWidth - Label width in mm
 * @param {number} labelHeight - Label height in mm
 * @returns {{ width: number, height: number }} Printable area dimensions in mm
 */
export function getPrintableArea(
  labelWidth: number,
  labelHeight: number
): { width: number; height: number } {
  return {
    width: labelWidth - LABEL_MARGINS.HORIZONTAL,
    height: labelHeight - LABEL_MARGINS.VERTICAL,
  }
}

/**
 * Calculate margin percentages for CSS positioning
 * @param {number} labelWidth - Label width in mm
 * @param {number} labelHeight - Label height in mm (printable area)
 * @returns {{ topBottom: number, leftRight: number }} Margin percentages
 */
export function getMarginPercentages(
  labelWidth: number,
  labelHeight: number
): { topBottom: number; leftRight: number } {
  // Note: labelHeight here is the printable area height, so we add margins for total tape height
  const totalTapeHeight = labelHeight + LABEL_MARGINS.VERTICAL
  return {
    topBottom: (LABEL_MARGINS.VERTICAL_SINGLE / totalTapeHeight) * 100,
    leftRight: (LABEL_MARGINS.HORIZONTAL_SINGLE / labelWidth) * 100,
  }
}

/**
 * Calculate canvas dimensions for label rendering
 * @param {number} labelWidthMm - Label width in mm
 * @param {number} labelHeightMm - Label height in mm (printable area)
 * @returns {LabelDimensions} Complete dimension calculations
 */
export function calculateCanvasDimensions(
  labelWidthMm: number,
  labelHeightMm: number
): LabelDimensions {
  const printableArea = getPrintableArea(labelWidthMm, labelHeightMm)
  const printableWidthMm = printableArea.width
  const printableHeightMm = printableArea.height

  // Calculate exact aspect ratio for proper rendering
  const exactAspectRatio = printableWidthMm / printableHeightMm

  // Convert height to pixels first, then calculate width to maintain aspect ratio
  const printableHeightPx = Math.round(mmToPx(printableHeightMm))
  const printableWidthPx = Math.round(printableHeightPx * exactAspectRatio)

  // Calculate conversion factor for other calculations
  const conversionFactor = printableWidthPx / printableWidthMm

  // Add debug logging
  logger.debug(`Label size (mm): ${labelWidthMm} × ${labelHeightMm}`)
  logger.debug(`Printable area (mm): ${printableWidthMm} × ${printableHeightMm}`)
  logger.debug(`Exact aspect ratio: ${exactAspectRatio.toFixed(6)}`)
  logger.debug(`Conversion factor: ${conversionFactor.toFixed(6)} px/mm`)
  logger.debug(`Canvas dimensions (px): ${printableWidthPx} × ${printableHeightPx}`)
  logger.debug(`Canvas aspect ratio: ${(printableWidthPx / printableHeightPx).toFixed(6)}`)

  return {
    printableWidthMm,
    printableHeightMm,
    printableWidthPx,
    printableHeightPx,
    conversionFactor,
  }
}

/**
 * Get tape size dimensions (including margins)
 * @param {number} labelWidth - Label width in mm
 * @param {number} labelHeight - Label height in mm (printable area)
 * @returns {{ width: number, height: number }} Tape size dimensions in mm
 */
export function getTapeSize(
  labelWidth: number,
  labelHeight: number
): { width: number; height: number } {
  return {
    width: labelWidth,
    height: labelHeight + LABEL_MARGINS.VERTICAL,
  }
}
