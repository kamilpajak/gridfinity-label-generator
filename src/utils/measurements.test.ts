import { describe, it, expect } from 'vitest'
import { mmToPx, validateWidth, validateHeight, validateTextSize } from './measurements'

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
      const tapeWidthMm = 54
      const tapeHeightMm = 12

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
    it('should return the input value if it is within valid range', () => {
      expect(validateWidth(37)).toBe(37)
      expect(validateWidth(55)).toBe(55)
      expect(validateWidth(100)).toBe(100)
    })

    it('should convert string values to numbers', () => {
      expect(validateWidth('50')).toBe(50)
      expect(validateWidth('75')).toBe(75)
    })

    it('should enforce minimum width of 37mm', () => {
      expect(validateWidth(30)).toBe(37)
      expect(validateWidth('20')).toBe(37)
    })

    it('should enforce maximum width of 100mm', () => {
      expect(validateWidth(120)).toBe(100)
      expect(validateWidth('150')).toBe(100)
    })

    it('should default to 55mm for invalid inputs', () => {
      expect(validateWidth(NaN)).toBe(55)
      expect(validateWidth('abc')).toBe(55)
    })
  })

  describe('validateHeight', () => {
    it('should return exact values for allowed heights (6, 9, 12, 18, 24, 36)', () => {
      expect(validateHeight(6)).toBe(6)
      expect(validateHeight(9)).toBe(9)
      expect(validateHeight(12)).toBe(12)
      expect(validateHeight(18)).toBe(18)
      expect(validateHeight(24)).toBe(24)
      expect(validateHeight(36)).toBe(36)
    })

    it('should snap to nearest allowed height for in-between values', () => {
      // Values closer to lower option
      expect(validateHeight(7)).toBe(6)
      expect(validateHeight(10)).toBe(9)
      expect(validateHeight(13)).toBe(12)
      expect(validateHeight(19)).toBe(18)
      expect(validateHeight(25)).toBe(24)

      // Values closer to higher option
      expect(validateHeight(8)).toBe(9)
      expect(validateHeight(11)).toBe(12)
      expect(validateHeight(17)).toBe(18)
      expect(validateHeight(23)).toBe(24)
      expect(validateHeight(35)).toBe(36)
    })

    it('should handle equidistant values by choosing the first (lower) option', () => {
      expect(validateHeight(7.5)).toBe(6) // Equidistant from 6 and 9
      expect(validateHeight(10.5)).toBe(9) // Equidistant from 9 and 12
      expect(validateHeight(15)).toBe(12) // Equidistant from 12 and 18
      expect(validateHeight(21)).toBe(18) // Equidistant from 18 and 24
      expect(validateHeight(30)).toBe(24) // Equidistant from 24 and 36
    })

    it('should handle string inputs correctly', () => {
      expect(validateHeight('6')).toBe(6)
      expect(validateHeight('12')).toBe(12)
      expect(validateHeight('15.5')).toBe(18)
      expect(validateHeight('7.2')).toBe(6)
      expect(validateHeight('28')).toBe(24)
    })

    it('should handle extreme values', () => {
      // Very small values snap to minimum (6)
      expect(validateHeight(0)).toBe(6)
      expect(validateHeight(-5)).toBe(6)
      expect(validateHeight(0.1)).toBe(6)

      // Very large values snap to maximum (36)
      expect(validateHeight(50)).toBe(36)
      expect(validateHeight(100)).toBe(36)
      expect(validateHeight(1000)).toBe(36)
    })

    it('should default to 12mm for invalid inputs', () => {
      expect(validateHeight(NaN)).toBe(12)
      expect(validateHeight('abc')).toBe(12)
      expect(validateHeight(undefined as any)).toBe(12)
      expect(validateHeight(null as any)).toBe(12)
      expect(validateHeight('')).toBe(12)
    })
  })

  describe('validateTextSize', () => {
    it('should return the input value if it is within valid range', () => {
      expect(validateTextSize(50)).toBe(50)
      expect(validateTextSize(100)).toBe(100)
      expect(validateTextSize(150)).toBe(150)
    })

    it('should convert string values to numbers', () => {
      expect(validateTextSize('75')).toBe(75)
      expect(validateTextSize('125')).toBe(125)
    })

    it('should round values to nearest integer', () => {
      expect(validateTextSize(75.4)).toBe(75)
      expect(validateTextSize(75.5)).toBe(76)
    })

    it('should enforce minimum text size of 50%', () => {
      expect(validateTextSize(25)).toBe(50)
      expect(validateTextSize('30')).toBe(50)
    })

    it('should enforce maximum text size of 150%', () => {
      expect(validateTextSize(175)).toBe(150)
      expect(validateTextSize('200')).toBe(150)
    })

    it('should default to 100% for invalid inputs', () => {
      expect(validateTextSize(NaN)).toBe(100)
      expect(validateTextSize('abc')).toBe(100)
    })
  })
})
