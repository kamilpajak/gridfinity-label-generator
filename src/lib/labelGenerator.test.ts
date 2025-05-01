import { describe, it, expect } from 'vitest'
import { getLabelTexts } from './labelGenerator'

describe('getLabelTexts', () => {
  it('returns correct texts for a screw with metric system', () => {
    const result = getLabelTexts('Screw', 'Metric', 'M5', '20', 'DIN 11014', '', true)

    expect(result.topText).toBe('M5 × 20')
    expect(result.bottomText).toBe('DIN 11014')
  })

  it('returns correct texts for a screw with imperial system', () => {
    const result = getLabelTexts('Screw', 'Imperial', '1/4-20', '1/2', 'DIN 11014', '', true)

    expect(result.topText).toBe('1/4-20 × 1/2″')
    expect(result.bottomText).toBe('DIN 11014')
  })

  it('returns correct texts for a nut', () => {
    const result = getLabelTexts('Nut', 'Metric', 'M5', '', 'DIN 934', '', true)

    expect(result.topText).toBe('M5')
    expect(result.bottomText).toBe('DIN 934')
  })

  it('includes notes in bottom text when provided', () => {
    const result = getLabelTexts('Screw', 'Metric', 'M5', '20', 'DIN 11014', 'Hex Head', true)

    expect(result.topText).toBe('M5 × 20')
    expect(result.bottomText).toBe('DIN 11014 Hex Head')
  })

  it('hides standard name when showStandardName is false', () => {
    const result = getLabelTexts('Screw', 'Metric', 'M5', '20', 'DIN 11014', 'Hex Head', false)

    expect(result.topText).toBe('M5 × 20')
    expect(result.bottomText).toBe('Hex Head')
  })

  it('returns empty bottom text when showStandardName is false and no notes', () => {
    const result = getLabelTexts('Screw', 'Metric', 'M5', '20', 'DIN 11014', '', false)

    expect(result.topText).toBe('M5 × 20')
    expect(result.bottomText).toBe('')
  })
})

// Note: We can't easily test the generateLabel function directly in a unit test
// because it relies on Canvas API and QR code generation which are not available in the test environment.
// For a complete test, we would need to use integration tests with a real browser environment.
