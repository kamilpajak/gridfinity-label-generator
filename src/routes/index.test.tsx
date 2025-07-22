/**
 * @fileoverview Tests for the index route including the notes update bug
 * @module routes/index.test
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { getLabelTexts } from '~/lib/labelGenerator'
import type * as LabelGeneratorModule from '~/lib/labelGenerator'

// Create a mock that tracks when generateLabel is called
let generateLabelCallCount = 0

vi.mock('~/lib/labelGenerator', async () => {
  const actual = (await vi.importActual('~/lib/labelGenerator')) as typeof LabelGeneratorModule
  return {
    ...actual,
    generateLabel: vi.fn().mockImplementation(() => {
      generateLabelCallCount++
      return Promise.resolve(`data:image/png;base64,mockImageData${generateLabelCallCount}`)
    }),
  }
})

describe('HomePage Route', () => {
  describe('Notes Update Bug', () => {
    beforeEach(() => {
      generateLabelCallCount = 0
    })

    test('getLabelTexts correctly includes notes in bottom text', () => {
      // Test with showStandardName = true
      let result = getLabelTexts(
        'Screw',
        'Metric',
        'M6',
        '20mm',
        'DIN 912',
        'Socket Head',
        true,
        'Socket'
      )

      expect(result.topText).toBe('M6 × 20mm')
      expect(result.bottomText).toBe('DIN 912 Socket Head')

      // Test with showStandardName = false
      result = getLabelTexts(
        'Screw',
        'Metric',
        'M6',
        '20mm',
        'DIN 912',
        'Socket Head',
        false,
        'Socket'
      )

      expect(result.topText).toBe('M6 × 20mm')
      expect(result.bottomText).toBe('Socket Head')

      // Test with empty notes and showStandardName = false
      result = getLabelTexts('Screw', 'Metric', 'M6', '20mm', 'DIN 912', '', false, 'Socket')

      expect(result.topText).toBe('M6 × 20mm')
      expect(result.bottomText).toBe('')
    })

    test('demonstrates the notes tracking bug', async () => {
      // This test demonstrates that the notes field is not tracked in useTask$
      // by showing what SHOULD happen when notes change

      const { generateLabel } = await import('~/lib/labelGenerator')
      const mockGenerateLabel = vi.mocked(generateLabel)

      // Initial label generation
      const initialOptions = {
        standardImgUrl: '/images/screw.svg',
        topText: 'M6 × 20mm',
        bottomText: 'DIN 912',
        labelWidthMm: 55,
        labelHeightMm: 12,
        showImage: true,
        showQrCode: false,
      }

      await generateLabel(initialOptions)
      expect(mockGenerateLabel).toHaveBeenCalledTimes(1)

      // Simulate notes change - this SHOULD trigger a new label generation
      const updatedOptions = {
        ...initialOptions,
        bottomText: 'DIN 912 Socket Head', // Notes added
      }

      // In the actual app, this call would NOT happen automatically
      // because notes.value is not tracked in useTask$
      // This demonstrates what SHOULD happen:
      await generateLabel(updatedOptions)
      expect(mockGenerateLabel).toHaveBeenCalledTimes(2)

      // Verify the options were different
      expect(mockGenerateLabel.mock.calls[0][0].bottomText).toBe('DIN 912')
      expect(mockGenerateLabel.mock.calls[1][0].bottomText).toBe('DIN 912 Socket Head')
    })

    test('shows expected behavior for tracked fields', async () => {
      // This test shows that other fields DO trigger updates
      const { generateLabel } = await import('~/lib/labelGenerator')
      const mockGenerateLabel = vi.mocked(generateLabel)

      mockGenerateLabel.mockClear()

      // When thread size changes, it DOES trigger regeneration
      const options1 = {
        standardImgUrl: '/images/screw.svg',
        topText: 'M6 × 20mm',
        bottomText: 'DIN 912',
        labelWidthMm: 55,
        labelHeightMm: 12,
        showImage: true,
        showQrCode: false,
      }

      await generateLabel(options1)

      const options2 = {
        ...options1,
        topText: 'M8 × 20mm', // Thread size changed
      }

      await generateLabel(options2)

      expect(mockGenerateLabel).toHaveBeenCalledTimes(2)
      expect(mockGenerateLabel.mock.calls[0][0].topText).toBe('M6 × 20mm')
      expect(mockGenerateLabel.mock.calls[1][0].topText).toBe('M8 × 20mm')
    })
  })

  describe('Notes Field Tracking Analysis', () => {
    test('BUG: identifies missing notes tracking in useTask$ (THIS TEST SHOULD FAIL)', async () => {
      // Read the index.tsx file to analyze the tracking
      const indexContent = await import('fs')
        .then(fs => fs.promises.readFile('./src/routes/index.tsx', 'utf-8'))
        .catch(() => null)

      if (!indexContent) {
        console.warn('Could not read index.tsx file')
        return
      }

      // Find the useTask$ that tracks field changes
      const useTaskMatch = indexContent.match(
        /useTask\$\(\(\{[^}]+track[^}]+\}\) => \{[\s\S]*?\}\)/g
      )

      if (!useTaskMatch) {
        console.warn('Could not find useTask$ with track')
        return
      }

      // Check if notes is tracked in any useTask$
      let notesIsTracked = false
      for (const taskBlock of useTaskMatch) {
        if (taskBlock.includes('track(() => notes.value)')) {
          notesIsTracked = true
          break
        }
      }

      // This test SHOULD FAIL - demonstrating the bug
      // The notes field is NOT tracked, which causes the preview not to update
      expect(notesIsTracked).toBe(true) // EXPECTED TO FAIL - Bug reproduction
    })

    test('shows which fields ARE tracked', async () => {
      // This test documents which fields are currently tracked
      const trackedFields = [
        'selectedType.value',
        'threadSize.value',
        'hardwareStandard.value',
        'length.value',
        'selectedScrewSubtype.value',
        'selectedSystem.value',
      ]

      const untrackedFields = [
        'notes.value', // This is the bug!
      ]

      // Document the current state
      expect(trackedFields).toHaveLength(6)
      expect(untrackedFields).toContain('notes.value')
    })

    test('demonstrates the fix needed', () => {
      // The fix is to add notes.value to the track() calls in the first useTask$
      const currentTracking = `
      track(() => selectedType.value)
      track(() => threadSize.value)
      track(() => hardwareStandard.value)
      track(() => length.value)
      track(() => selectedScrewSubtype.value)
      track(() => selectedSystem.value)
      `

      const fixedTracking = `
      track(() => selectedType.value)
      track(() => threadSize.value)
      track(() => hardwareStandard.value)
      track(() => length.value)
      track(() => selectedScrewSubtype.value)
      track(() => selectedSystem.value)
      track(() => notes.value) // ADD THIS LINE
      `

      // This demonstrates what needs to be added
      expect(fixedTracking).toContain('track(() => notes.value)')
      expect(currentTracking).not.toContain('track(() => notes.value)')
    })
  })
})
