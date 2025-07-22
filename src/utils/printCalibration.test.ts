import { describe, it, expect } from 'vitest'
import {
  calculateWidthForPrinting,
  calculateExpectedPrintedWidth,
  calculateScalingFactor,
} from './printCalibration'
import { PRINT_CALIBRATION } from '~/test-utils/constants'

describe('Print Calibration Utilities', () => {
  describe('calculateWidthForPrinting', () => {
    it('should calculate the correct width to set for desired printed width', () => {
      // Test with default scaling factor (1.0)
      expect(calculateWidthForPrinting(PRINT_CALIBRATION.TEST_WIDTHS.STANDARD)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.STANDARD,
        2
      )
      expect(calculateWidthForPrinting(PRINT_CALIBRATION.TEST_WIDTHS.LARGE)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.LARGE,
        2
      )

      // Test with custom scaling factor
      expect(
        calculateWidthForPrinting(
          PRINT_CALIBRATION.TEST_WIDTHS.STANDARD,
          PRINT_CALIBRATION.SCALING_FACTORS.MEDIUM
        )
      ).toBeCloseTo(PRINT_CALIBRATION.EXPECTED_VALUES.WIDTH_54_SCALE_1_1, 2)
      expect(
        calculateWidthForPrinting(
          PRINT_CALIBRATION.TEST_WIDTHS.LARGE,
          PRINT_CALIBRATION.SCALING_FACTORS.LARGE
        )
      ).toBeCloseTo(PRINT_CALIBRATION.EXPECTED_VALUES.WIDTH_100_SCALE_1_2, 2)
    })

    it('should handle edge cases', () => {
      // Zero width
      expect(calculateWidthForPrinting(0)).toBe(0)

      // Very small width
      expect(calculateWidthForPrinting(PRINT_CALIBRATION.TEST_WIDTHS.SMALL)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.SMALL,
        2
      )

      // Very large width
      expect(calculateWidthForPrinting(PRINT_CALIBRATION.TEST_WIDTHS.VERY_LARGE)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.VERY_LARGE,
        1
      )
    })
  })

  describe('calculateExpectedPrintedWidth', () => {
    it('should calculate the expected printed width based on set width', () => {
      // Test with default scaling factor (1.0)
      expect(calculateExpectedPrintedWidth(PRINT_CALIBRATION.TEST_WIDTHS.STANDARD)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.STANDARD,
        2
      )
      expect(calculateExpectedPrintedWidth(PRINT_CALIBRATION.TEST_WIDTHS.LARGE)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.LARGE,
        2
      )

      // Test with custom scaling factor
      expect(
        calculateExpectedPrintedWidth(49.09, PRINT_CALIBRATION.SCALING_FACTORS.MEDIUM)
      ).toBeCloseTo(PRINT_CALIBRATION.EXPECTED_VALUES.PRINTED_49_09_SCALE_1_1, 2)
      expect(
        calculateExpectedPrintedWidth(83.33, PRINT_CALIBRATION.SCALING_FACTORS.LARGE)
      ).toBeCloseTo(PRINT_CALIBRATION.EXPECTED_VALUES.PRINTED_83_33_SCALE_1_2, 2)
    })

    it('should handle edge cases', () => {
      // Zero width
      expect(calculateExpectedPrintedWidth(0)).toBe(0)

      // Very small width
      expect(calculateExpectedPrintedWidth(PRINT_CALIBRATION.TEST_WIDTHS.SMALL)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.SMALL,
        2
      )

      // Very large width
      expect(calculateExpectedPrintedWidth(PRINT_CALIBRATION.TEST_WIDTHS.VERY_LARGE)).toBeCloseTo(
        PRINT_CALIBRATION.TEST_WIDTHS.VERY_LARGE,
        1
      )
    })
  })

  describe('calculateScalingFactor', () => {
    it('should calculate the correct scaling factor', () => {
      expect(calculateScalingFactor(PRINT_CALIBRATION.TEST_WIDTHS.STANDARD, 58)).toBeCloseTo(
        PRINT_CALIBRATION.SCALING_FACTORS.SMALL,
        3
      )
      expect(calculateScalingFactor(PRINT_CALIBRATION.TEST_WIDTHS.LARGE, 110)).toBeCloseTo(
        PRINT_CALIBRATION.SCALING_FACTORS.MEDIUM,
        3
      )
    })

    it('should handle edge cases', () => {
      // Equal values
      expect(calculateScalingFactor(50, 50)).toBe(1)

      // Zero set width should throw or return Infinity
      expect(() => calculateScalingFactor(0, 50)).not.toThrow()
      expect(calculateScalingFactor(0, 50)).toBe(Infinity)
    })
  })

  describe('Relationship between functions', () => {
    it('should maintain consistency between functions', () => {
      // If we calculate width to set for a desired printed width,
      // then calculate expected printed width from that result,
      // we should get back the original desired width

      const desiredWidth = PRINT_CALIBRATION.TEST_WIDTHS.STANDARD
      const widthToSet = calculateWidthForPrinting(desiredWidth)
      const expectedPrintedWidth = calculateExpectedPrintedWidth(widthToSet)

      expect(expectedPrintedWidth).toBeCloseTo(desiredWidth, 5)

      // Similarly, if we calculate a scaling factor and use it in both functions,
      // they should be consistent

      const setWidth = 50
      const actualPrintedWidth = 55
      const scalingFactor = calculateScalingFactor(setWidth, actualPrintedWidth)

      expect(calculateExpectedPrintedWidth(setWidth, scalingFactor)).toBeCloseTo(
        actualPrintedWidth,
        5
      )
      expect(calculateWidthForPrinting(actualPrintedWidth, scalingFactor)).toBeCloseTo(setWidth, 5)
    })
  })
})
