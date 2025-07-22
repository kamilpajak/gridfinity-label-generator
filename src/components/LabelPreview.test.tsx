/**
 * @fileoverview Tests for LabelPreview component helpers
 * @module LabelPreview.test
 *
 * Note: The core dimension calculation logic is tested in src/utils/labelDimensions.test.ts
 * These tests focus on component-specific helpers and layout validation.
 */

import { describe, expect, test } from 'vitest'
import {
  calculateDimensions,
  calculateMargins,
  checkQrCodeDisplay,
  generateAltText,
  getAspectRatio,
  getPlaceholderText,
  validateLabelLayout,
} from '~/test-utils/label-preview.helpers'

describe('LabelPreview Component Helpers', () => {
  // Test the dimensions calculations with default height
  test('calculates correct dimensions for tape size and printable area with default height', () => {
    const labelWidth = 55
    const dimensions = calculateDimensions(labelWidth)

    // Check tape size dimensions
    expect(dimensions.tapeSize.width).toBe(labelWidth)
    expect(dimensions.tapeSize.height).toBe(12) // 10mm height + 2mm margins
    expect(dimensions.tapeSize.text).toContain(`${labelWidth}mm × 12mm`)
    expect(dimensions.tapeSize.text).toContain('tape size')

    // Check printable area dimensions
    expect(dimensions.printableArea.width).toBe(labelWidth - 4)
    expect(dimensions.printableArea.height).toBe(10)
    expect(dimensions.printableArea.text).toContain(`${labelWidth - 4}mm × 10mm`)
    expect(dimensions.printableArea.text).toContain('printable area')
  })

  // Test the dimensions calculations with custom height
  test('calculates correct dimensions for tape size and printable area with custom height', () => {
    const labelWidth = 55
    const labelHeight = 15
    const dimensions = calculateDimensions(labelWidth, labelHeight)

    // Check tape size dimensions
    expect(dimensions.tapeSize.width).toBe(labelWidth)
    expect(dimensions.tapeSize.height).toBe(labelHeight + 2) // labelHeight + 2mm margins
    expect(dimensions.tapeSize.text).toContain(`${labelWidth}mm × ${labelHeight + 2}mm`)
    expect(dimensions.tapeSize.text).toContain('tape size')

    // Check printable area dimensions
    expect(dimensions.printableArea.width).toBe(labelWidth - 4)
    expect(dimensions.printableArea.height).toBe(labelHeight)
    expect(dimensions.printableArea.text).toContain(`${labelWidth - 4}mm × ${labelHeight}mm`)
    expect(dimensions.printableArea.text).toContain('printable area')
  })

  // Test the margin calculations with default height
  test('calculates correct margin percentages with default height', () => {
    const labelWidth = 55
    const margins = calculateMargins(labelWidth)

    // Calculate expected margin percentages
    const expectedTopBottomMargin = (1 / 12) * 100 // 8.33%
    const expectedLeftRightMargin = (2 / labelWidth) * 100 // ~3.64%

    // Test that our calculations match what we expect
    expect(margins.top).toBeCloseTo(expectedTopBottomMargin)
    expect(margins.bottom).toBeCloseTo(expectedTopBottomMargin)
    expect(margins.left).toBeCloseTo(expectedLeftRightMargin)
    expect(margins.right).toBeCloseTo(expectedLeftRightMargin)
  })

  // Test the margin calculations with custom height
  test('calculates correct margin percentages with custom height', () => {
    const labelWidth = 55
    const labelHeight = 15
    const margins = calculateMargins(labelWidth, labelHeight)

    // Calculate expected margin percentages
    const expectedTopBottomMargin = (1 / (labelHeight + 2)) * 100 // 1mm out of 17mm = ~5.88%
    const expectedLeftRightMargin = (2 / labelWidth) * 100 // 2mm out of 55mm = ~3.64%

    // Test that our calculations match what we expect
    expect(margins.top).toBeCloseTo(expectedTopBottomMargin)
    expect(margins.bottom).toBeCloseTo(expectedTopBottomMargin)
    expect(margins.left).toBeCloseTo(expectedLeftRightMargin)
    expect(margins.right).toBeCloseTo(expectedLeftRightMargin)
  })

  // Test the placeholder text
  test('returns correct placeholder text', () => {
    const placeholder = getPlaceholderText()
    expect(placeholder).toBe('Fill out the form to generate a label')
  })

  // Test the image alt text with default height
  test('generates correct alt text with default height', () => {
    const labelWidth = 55
    const altText = generateAltText(labelWidth)

    expect(altText).toBe(`Generated label with dimensions ${labelWidth - 4}mm × 10mm`)
  })

  // Test the image alt text with custom height
  test('generates correct alt text with custom height', () => {
    const labelWidth = 55
    const labelHeight = 15
    const altText = generateAltText(labelWidth, labelHeight)

    expect(altText).toBe(`Generated label with dimensions ${labelWidth - 4}mm × ${labelHeight}mm`)
  })

  // Test the aspect ratio with default height
  test('calculates correct aspect ratio for tape container with default height', () => {
    const labelWidth = 55
    const aspectRatio = getAspectRatio(labelWidth)

    expect(aspectRatio).toBe(`${labelWidth} / 12`)
  })

  // Test the aspect ratio with custom height
  test('calculates correct aspect ratio for tape container with custom height', () => {
    const labelWidth = 55
    const labelHeight = 15
    const aspectRatio = getAspectRatio(labelWidth, labelHeight)

    expect(aspectRatio).toBe(`${labelWidth} / ${labelHeight + 2}`)
  })

  // Test QR code display
  test('correctly handles QR code display based on showQrCode prop', () => {
    // Test when QR code is enabled
    let qrCodeInfo = checkQrCodeDisplay(true)
    expect(qrCodeInfo.isVisible).toBe(true)
    expect(qrCodeInfo.position).toBe('right side of the label')
    expect(qrCodeInfo.dimensions).toBe('10mm × 10mm')

    // Test when QR code is disabled
    qrCodeInfo = checkQrCodeDisplay(false)
    expect(qrCodeInfo.isVisible).toBe(false)
  })

  // Test that label elements don't overlap with default height
  test('ensures label elements (image, text, QR code) do not overlap with default height', () => {
    // Test with all elements visible on a standard width label
    const standardWidth = 55
    let layout = validateLabelLayout(standardWidth, true, true)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.hasEnoughTextSpace).toBe(true)
    expect(layout.labelHeight).toBe(10) // Default height

    // Verify positions - image on left, text in middle, QR on right
    expect(layout.layout.image?.x).toBe(0)
    expect(layout.layout.text.x).toBeGreaterThan(0)
    expect(layout.layout.qrCode?.x).toBeGreaterThan(layout.layout.text.x)

    // Test with smaller label width (45mm) in different configurations
    const smallerWidth = 45

    // With all elements
    layout = validateLabelLayout(smallerWidth, true, true)

    // With image but no QR code
    const layoutWithImageNoQr = validateLabelLayout(smallerWidth, true, false)
    expect(layoutWithImageNoQr.elementsOverlap).toBe(false)
    expect(layoutWithImageNoQr.hasEnoughTextSpace).toBe(true)
    // Text area should be larger when there's no QR code
    expect(layoutWithImageNoQr.textAreaWidth).toBeGreaterThan(layout.textAreaWidth)

    // With QR code but no image
    layout = validateLabelLayout(smallerWidth, false, true)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.hasEnoughTextSpace).toBe(true)

    // With neither image nor QR code
    layout = validateLabelLayout(smallerWidth, false, false)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.hasEnoughTextSpace).toBe(true)
    expect(layout.textAreaWidth).toBe(smallerWidth)
  })

  // Test with different label heights
  test('handles different label heights correctly', () => {
    const standardWidth = 55

    // Test with taller label (20mm)
    let layout = validateLabelLayout(standardWidth, true, true, 20)
    expect(layout.labelHeight).toBe(20)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.hasEnoughTextSpace).toBe(true)
    // QR code should still be 10mm max
    expect(layout.qrCodeWidth).toBe(10)
    // Image can be larger
    expect(layout.imageWidth).toBeGreaterThan(10)

    // Test with shorter label (5mm)
    layout = validateLabelLayout(standardWidth, true, true, 5)
    expect(layout.labelHeight).toBe(5)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.hasEnoughTextSpace).toBe(true)
    // QR code should be 5mm (same as height)
    expect(layout.qrCodeWidth).toBe(5)
    // Image should be smaller
    expect(layout.imageWidth).toBeLessThanOrEqual(5)

    // Test different combinations with custom height
    const customHeight = 15
    const width = 50

    // With all elements
    layout = validateLabelLayout(width, true, true, customHeight)
    expect(layout.labelHeight).toBe(customHeight)
    expect(layout.elementsOverlap).toBe(false)

    // With image but no QR code
    layout = validateLabelLayout(width, true, false, customHeight)
    expect(layout.labelHeight).toBe(customHeight)
    expect(layout.layout.qrCode).toBeNull()

    // With QR code but no image
    layout = validateLabelLayout(width, false, true, customHeight)
    expect(layout.labelHeight).toBe(customHeight)
    expect(layout.layout.image).toBeNull()

    // With neither image nor QR code
    layout = validateLabelLayout(width, false, false, customHeight)
    expect(layout.labelHeight).toBe(customHeight)
    expect(layout.layout.image).toBeNull()
    expect(layout.layout.qrCode).toBeNull()
  })

  // Test edge cases with very narrow labels
  test('handles edge cases with very narrow labels', () => {
    // Test with minimum viable width
    const minimumWidth = 40
    let layout = validateLabelLayout(minimumWidth, true, true)
    expect(layout.elementsOverlap).toBe(false)

    // Test with very narrow label
    const narrowWidth = 15
    layout = validateLabelLayout(narrowWidth, true, true)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.textAreaWidth).toBeLessThan(10)

    // Test narrow label with custom height
    layout = validateLabelLayout(narrowWidth, true, true, 15)
    expect(layout.elementsOverlap).toBe(false)
    expect(layout.labelHeight).toBe(15)
  })
})
