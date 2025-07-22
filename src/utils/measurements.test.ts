/**
 * @fileoverview Tests for measurement conversion and validation utilities
 * @module measurements.test
 */

import { describe, it, expect } from 'vitest'
import { mmToPx, validateWidth, validateHeight, validateTextSize } from './measurements'
import {
  testValidationFunction,
  testDiscreteValidation,
  testRoundingValidation,
} from '~/test-utils/validation.helpers'
import { LABEL_DIMENSIONS, TEXT_SIZES } from '~/test-utils/constants'

/**
 * Test suite for measurement utilities
 */
describe('Measurements utilities', () => {
  describe('mmToPx', () => {
    it('should convert millimeters to pixels correctly', () => {
      // Test with various mm values
      expect(mmToPx(1)).toBeCloseTo(14.173228346, 5)
      expect(mmToPx(10)).toBeCloseTo(141.73228346, 5)
      expect(mmToPx(50)).toBeCloseTo(708.6614173, 5)

      // Test the conversion factor for a standard label width
      const labelWidthMm = 54
      const expectedPx = 54 * 14.173228346
      expect(mmToPx(labelWidthMm)).toBeCloseTo(expectedPx, 5)

      // Verify the conversion factor is consistent
      const ratio1 = mmToPx(10) / 10
      const ratio2 = mmToPx(50) / 50
      expect(ratio1).toBeCloseTo(ratio2, 10)
    })

    it('should maintain correct aspect ratio for label dimensions', () => {
      // Standard label dimensions
      const labelWidthMm = 54
      const labelHeightMm = 10

      // Convert to pixels
      const labelWidthPx = mmToPx(labelWidthMm)
      const labelHeightPx = mmToPx(labelHeightMm)

      // Calculate aspect ratios
      const mmAspectRatio = labelWidthMm / labelHeightMm
      const pxAspectRatio = labelWidthPx / labelHeightPx

      // Verify aspect ratios match
      expect(pxAspectRatio).toBeCloseTo(mmAspectRatio, 10)
      expect(pxAspectRatio).toBeCloseTo(5.4, 1) // 54mm / 10mm = 5.4
    })

    it('should calculate printable area dimensions correctly', () => {
      // Tape size dimensions
      const tapeWidthMm = LABEL_DIMENSIONS.WIDTHS.DEFAULT
      const tapeHeightMm = LABEL_DIMENSIONS.HEIGHTS.DEFAULT

      // Printable area dimensions (4mm narrower, 2mm shorter)
      const printableWidthMm = tapeWidthMm - 4
      const printableHeightMm = tapeHeightMm - 2

      // Convert to pixels
      const tapeWidthPx = mmToPx(tapeWidthMm)
      const tapeHeightPx = mmToPx(tapeHeightMm)
      const printableWidthPx = mmToPx(printableWidthMm)
      const printableHeightPx = mmToPx(printableHeightMm)

      // Verify pixel dimensions
      expect(printableWidthPx).toBeCloseTo(tapeWidthPx - mmToPx(4), 5)
      expect(printableHeightPx).toBeCloseTo(tapeHeightPx - mmToPx(2), 5)

      // Verify margins
      const leftRightMarginPx = mmToPx(2)
      const topBottomMarginPx = mmToPx(1)

      expect(tapeWidthPx - printableWidthPx).toBeCloseTo(leftRightMarginPx * 2, 5)
      expect(tapeHeightPx - printableHeightPx).toBeCloseTo(topBottomMarginPx * 2, 5)
    })
  })

  describe('validateWidth', () => {
    testValidationFunction(validateWidth, {
      defaultValue: 55, // validateWidth defaults to 55mm
      validCases: [
        [LABEL_DIMENSIONS.WIDTHS.MIN, LABEL_DIMENSIONS.WIDTHS.MIN],
        [LABEL_DIMENSIONS.WIDTHS.DEFAULT, LABEL_DIMENSIONS.WIDTHS.DEFAULT],
        [LABEL_DIMENSIONS.WIDTHS.MAX, LABEL_DIMENSIONS.WIDTHS.MAX],
      ],
      stringCases: [
        ['50', 50],
        ['75', 75],
      ],
      minCases: [
        [30, LABEL_DIMENSIONS.WIDTHS.MIN],
        [20, LABEL_DIMENSIONS.WIDTHS.MIN],
      ],
      maxCases: [
        [120, LABEL_DIMENSIONS.WIDTHS.MAX],
        [150, LABEL_DIMENSIONS.WIDTHS.MAX],
      ],
      invalidCases: [NaN, 'abc'],
      functionName: 'validateWidth',
    })
  })

  describe('validateHeight', () => {
    testDiscreteValidation(validateHeight, {
      allowedValues: [...LABEL_DIMENSIONS.HEIGHTS.ALLOWED_VALUES],
      defaultValue: LABEL_DIMENSIONS.HEIGHTS.DEFAULT,
      snapCases: [
        [8, 9],
        [10, 9],
        [10.5, 9], // Equidistant from 9 and 12
        [11, 12],
        [13, 12],
        [15, 12], // Equidistant from 12 and 18
        [17, 18],
        [19, 18],
        [21, 18], // Equidistant from 18 and 24
        [23, 24],
        [25, 24],
      ],
      functionName: 'validateHeight',
    })

    it('should handle string inputs correctly', () => {
      expect(validateHeight('9')).toBe(9)
      expect(validateHeight('12')).toBe(12)
      expect(validateHeight('15.5')).toBe(18)
      expect(validateHeight('10')).toBe(9)
      expect(validateHeight('28')).toBe(24)
    })

    it('should default to 12mm for invalid inputs', () => {
      expect(validateHeight(NaN)).toBe(12)
      expect(validateHeight('abc')).toBe(12)
      expect(validateHeight('')).toBe(12)
    })
  })

  describe('validateTextSize', () => {
    testValidationFunction(validateTextSize, {
      defaultValue: 100, // validateTextSize defaults to 100%
      validCases: [
        [TEXT_SIZES.MIN, TEXT_SIZES.MIN], // 50%
        [100, 100], // 100%
        [TEXT_SIZES.MAX, TEXT_SIZES.MAX], // 150%
      ],
      stringCases: [
        ['75', 75],
        ['125', 125],
      ],
      minCases: [
        [25, TEXT_SIZES.MIN], // 25 -> 50
        [30, TEXT_SIZES.MIN], // 30 -> 50
      ],
      maxCases: [
        [175, TEXT_SIZES.MAX], // 175 -> 150
        [200, TEXT_SIZES.MAX], // 200 -> 150
      ],
      invalidCases: [NaN, 'abc'],
      functionName: 'validateTextSize',
    })

    testRoundingValidation(validateTextSize, {
      roundingCases: [
        [75.4, 75],
        [75.5, 76],
      ],
      functionName: 'validateTextSize rounding',
    })
  })
})
