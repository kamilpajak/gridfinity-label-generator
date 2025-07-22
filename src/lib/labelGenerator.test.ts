/**
 * @fileoverview Tests for label generation utilities
 * @module labelGenerator.test
 */

import { describe, it, expect } from 'vitest'
import { getLabelTexts } from './labelGenerator'
import { assertMatchesPattern } from '~/test-utils/assertions'
import { HARDWARE_TYPES } from '~/test-utils/constants'

/**
 * Test suite for label text generation
 */
describe('getLabelTexts', () => {
  it('returns correct texts for a screw with metric system', () => {
    const result = getLabelTexts(
      'Screw',
      'Metric',
      HARDWARE_TYPES.THREAD_SIZES.METRIC[0],
      HARDWARE_TYPES.LENGTHS.METRIC[0],
      HARDWARE_TYPES.STANDARDS.SCREW[0],
      '',
      true
    )

    expect(result.topText).toBe('M5 × 20')
    expect(result.bottomText).toBe('DIN 11014')
    assertMatchesPattern(result.topText, /M\d+ × \d+/)
  })

  it('returns correct texts for a screw with imperial system', () => {
    const result = getLabelTexts(
      'Screw',
      'Imperial',
      HARDWARE_TYPES.THREAD_SIZES.IMPERIAL[0],
      HARDWARE_TYPES.LENGTHS.IMPERIAL[0],
      HARDWARE_TYPES.STANDARDS.SCREW[0],
      '',
      true
    )

    expect(result.topText).toBe('1/4-20 × 1/2″')
    expect(result.bottomText).toBe('DIN 11014')
    // More specific regex to avoid ReDoS vulnerability
    assertMatchesPattern(result.topText, /^\d+\/\d+-\d+ × \d+\/\d+″$/)
  })

  it('returns correct texts for a nut', () => {
    const result = getLabelTexts(
      'Nut',
      'Metric',
      HARDWARE_TYPES.THREAD_SIZES.METRIC[0],
      '',
      HARDWARE_TYPES.STANDARDS.NUT[0],
      '',
      true
    )

    expect(result.topText).toBe('M5')
    expect(result.bottomText).toBe('DIN 934')
    assertMatchesPattern(result.topText, /M\d+/)
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

/**
 * Note: We can't easily test the generateLabel function directly in a unit test
 * because it relies on Canvas API and QR code generation which are not available in the test environment.
 * For a complete test, we would need to use integration tests with a real browser environment.
 * The canvas mocks in our test-utils could be used for more comprehensive testing if needed.
 */
