/**
 * @fileoverview Tests for label dimension calculations
 * @module labelDimensions.test
 */

import { describe, it, expect } from 'vitest'
import {
  LABEL_MARGINS,
  getPrintableArea,
  getMarginPercentages,
  calculateCanvasDimensions,
  getTapeSize,
} from './labelDimensions'

/**
 * Test suite for label dimension utilities
 */
describe('Label Dimensions Utilities', () => {
  describe('LABEL_MARGINS constant', () => {
    it('should have correct margin values', () => {
      expect(LABEL_MARGINS.HORIZONTAL).toBe(4)
      expect(LABEL_MARGINS.VERTICAL).toBe(2)
      expect(LABEL_MARGINS.HORIZONTAL_SINGLE).toBe(2)
      expect(LABEL_MARGINS.VERTICAL_SINGLE).toBe(1)
    })
  })

  describe('getPrintableArea', () => {
    it('should calculate printable area correctly for standard label', () => {
      const result = getPrintableArea(54, 12)
      expect(result.width).toBe(50) // 54 - 4
      expect(result.height).toBe(10) // 12 - 2
    })

    it('should calculate printable area correctly for various sizes', () => {
      // Minimum size
      expect(getPrintableArea(37, 9)).toEqual({ width: 33, height: 7 })

      // Maximum size
      expect(getPrintableArea(100, 24)).toEqual({ width: 96, height: 22 })

      // Custom size
      expect(getPrintableArea(60, 15)).toEqual({ width: 56, height: 13 })
    })
  })

  describe('getMarginPercentages', () => {
    it('should calculate margin percentages correctly for standard label', () => {
      const result = getMarginPercentages(54, 10) // 10mm is printable height

      // Total tape height is 10 + 2 = 12mm
      // Top/bottom margin: 1mm / 12mm = 8.333...%
      expect(result.topBottom).toBeCloseTo(8.333, 2)

      // Left/right margin: 2mm / 54mm = 3.703...%
      expect(result.leftRight).toBeCloseTo(3.704, 2)
    })

    it('should calculate margin percentages for different sizes', () => {
      // Smaller label
      const small = getMarginPercentages(37, 7)
      expect(small.topBottom).toBeCloseTo(11.111, 2) // 1 / 9
      expect(small.leftRight).toBeCloseTo(5.405, 2) // 2 / 37

      // Larger label
      const large = getMarginPercentages(100, 22)
      expect(large.topBottom).toBeCloseTo(4.167, 2) // 1 / 24
      expect(large.leftRight).toBe(2) // 2 / 100
    })
  })

  describe('calculateCanvasDimensions', () => {
    it('should calculate canvas dimensions correctly', () => {
      const result = calculateCanvasDimensions(54, 12)

      // Check mm dimensions
      expect(result.printableWidthMm).toBe(50)
      expect(result.printableHeightMm).toBe(10)

      // Check that pixel dimensions maintain aspect ratio
      const mmAspectRatio = result.printableWidthMm / result.printableHeightMm
      const pxAspectRatio = result.printableWidthPx / result.printableHeightPx
      expect(pxAspectRatio).toBeCloseTo(mmAspectRatio, 2)

      // Check conversion factor
      expect(result.conversionFactor).toBeCloseTo(
        result.printableWidthPx / result.printableWidthMm,
        6
      )
    })

    it('should maintain consistent aspect ratio for different sizes', () => {
      const sizes = [
        { width: 37, height: 9 },
        { width: 54, height: 12 },
        { width: 100, height: 24 },
      ]

      sizes.forEach(({ width, height }) => {
        const result = calculateCanvasDimensions(width, height)
        const mmAspectRatio = result.printableWidthMm / result.printableHeightMm
        const pxAspectRatio = result.printableWidthPx / result.printableHeightPx

        expect(pxAspectRatio).toBeCloseTo(mmAspectRatio, 2)
      })
    })
  })

  describe('getTapeSize', () => {
    it('should return correct tape dimensions', () => {
      // Standard label (printable area 10mm height)
      const result = getTapeSize(54, 10)
      expect(result.width).toBe(54)
      expect(result.height).toBe(12) // 10 + 2
    })

    it('should handle various sizes correctly', () => {
      expect(getTapeSize(37, 7)).toEqual({ width: 37, height: 9 })
      expect(getTapeSize(100, 22)).toEqual({ width: 100, height: 24 })
    })
  })

  describe('Integration with real calculations', () => {
    it('should produce consistent results across all functions', () => {
      const labelWidth = 54
      const labelHeight = 12

      // Get printable area
      const printable = getPrintableArea(labelWidth, labelHeight)
      expect(printable.width).toBe(50)
      expect(printable.height).toBe(10)

      // Get tape size (inverse of printable area)
      const tape = getTapeSize(labelWidth, printable.height)
      expect(tape.width).toBe(labelWidth)
      expect(tape.height).toBe(labelHeight)

      // Calculate dimensions
      const dimensions = calculateCanvasDimensions(labelWidth, labelHeight)
      expect(dimensions.printableWidthMm).toBe(printable.width)
      expect(dimensions.printableHeightMm).toBe(printable.height)

      // Verify margins are consistent
      const margins = getMarginPercentages(labelWidth, printable.height)
      const expectedTopMargin = (LABEL_MARGINS.VERTICAL_SINGLE / tape.height) * 100
      const expectedLeftMargin = (LABEL_MARGINS.HORIZONTAL_SINGLE / tape.width) * 100

      expect(margins.topBottom).toBeCloseTo(expectedTopMargin, 6)
      expect(margins.leftRight).toBeCloseTo(expectedLeftMargin, 6)
    })
  })
})
