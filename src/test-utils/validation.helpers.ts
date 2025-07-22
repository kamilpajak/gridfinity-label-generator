/**
 * @fileoverview Helper functions for testing validation utilities
 * @module test-utils/validation.helpers
 */

import { describe, it, expect } from 'vitest'

/**
 * Configuration for validation function tests
 * @typedef {Object} ValidationTestConfig
 * @property {number} defaultValue - Expected default value when input is invalid
 * @property {Array<[any, number]>} validCases - Array of [input, expectedOutput] pairs for valid inputs
 * @property {Array<[any, number]>} stringCases - Array of [stringInput, expectedOutput] pairs
 * @property {Array<[any, number]>} minCases - Array of [input, expectedMinOutput] pairs for minimum boundary
 * @property {Array<[any, number]>} maxCases - Array of [input, expectedMaxOutput] pairs for maximum boundary
 * @property {Array<any>} invalidCases - Array of invalid inputs that should return default value
 * @property {string} [functionName] - Name of the function being tested (for test descriptions)
 */
interface ValidationTestConfig {
  defaultValue: number
  validCases: Array<[any, number]>
  stringCases: Array<[any, number]>
  minCases: Array<[any, number]>
  maxCases: Array<[any, number]>
  invalidCases: any[]
  functionName?: string
}

/**
 * Tests a validation function with common test cases
 * @param {Function} validationFn - The validation function to test
 * @param {ValidationTestConfig} config - Test configuration
 * @example
 * testValidationFunction(validateWidth, {
 *   defaultValue: 55,
 *   validCases: [[50, 50], [75, 75]],
 *   stringCases: [['50', 50], ['75', 75]],
 *   minCases: [[30, 37], [20, 37]],
 *   maxCases: [[120, 100], [150, 100]],
 *   invalidCases: [NaN, 'abc', null, undefined],
 *   functionName: 'validateWidth'
 * })
 */
export function testValidationFunction(
  validationFn: (value: any) => number,
  config: ValidationTestConfig
): void {
  const fnName = config.functionName || 'validation function'

  describe(`${fnName} - valid inputs`, () => {
    it('should return the input value if it is within valid range', () => {
      config.validCases.forEach(([input, expected]) => {
        expect(validationFn(input)).toBe(expected)
      })
    })
  })

  describe(`${fnName} - string conversion`, () => {
    it('should convert string values to numbers', () => {
      config.stringCases.forEach(([input, expected]) => {
        expect(validationFn(input)).toBe(expected)
      })
    })
  })

  if (config.minCases.length > 0) {
    describe(`${fnName} - minimum boundary`, () => {
      it('should enforce minimum value', () => {
        config.minCases.forEach(([input, expected]) => {
          expect(validationFn(input)).toBe(expected)
        })
      })
    })
  }

  if (config.maxCases.length > 0) {
    describe(`${fnName} - maximum boundary`, () => {
      it('should enforce maximum value', () => {
        config.maxCases.forEach(([input, expected]) => {
          expect(validationFn(input)).toBe(expected)
        })
      })
    })
  }

  describe(`${fnName} - invalid inputs`, () => {
    it(`should default to ${config.defaultValue} for invalid inputs`, () => {
      config.invalidCases.forEach(input => {
        expect(validationFn(input)).toBe(config.defaultValue)
      })
    })
  })
}

/**
 * Configuration for testing discrete value validation
 * @typedef {Object} DiscreteValidationTestConfig
 * @property {number[]} allowedValues - Array of allowed discrete values
 * @property {number} defaultValue - Default value when input is invalid
 * @property {Array<[number, number]>} snapCases - Array of [input, expectedSnappedValue] pairs
 * @property {string} [functionName] - Name of the function being tested
 */
interface DiscreteValidationTestConfig {
  allowedValues: number[]
  defaultValue: number
  snapCases: Array<[number, number]>
  functionName?: string
}

/**
 * Tests a validation function that snaps to discrete values
 * @param {Function} validationFn - The validation function to test
 * @param {DiscreteValidationTestConfig} config - Test configuration
 * @example
 * testDiscreteValidation(validateHeight, {
 *   allowedValues: [9, 12, 18, 24],
 *   defaultValue: 12,
 *   snapCases: [[10, 9], [11, 12], [15, 12], [20, 18]],
 *   functionName: 'validateHeight'
 * })
 */
export function testDiscreteValidation(
  validationFn: (value: any) => number,
  config: DiscreteValidationTestConfig
): void {
  const fnName = config.functionName || 'discrete validation function'

  describe(`${fnName} - allowed values`, () => {
    it('should return exact values for allowed inputs', () => {
      config.allowedValues.forEach(value => {
        expect(validationFn(value)).toBe(value)
        expect(validationFn(value.toString())).toBe(value)
      })
    })
  })

  describe(`${fnName} - snap to nearest`, () => {
    it('should snap to nearest allowed value', () => {
      config.snapCases.forEach(([input, expected]) => {
        expect(validationFn(input)).toBe(expected)
      })
    })
  })

  describe(`${fnName} - edge cases`, () => {
    it('should handle extreme values', () => {
      const min = Math.min(...config.allowedValues)
      const max = Math.max(...config.allowedValues)

      // Values below minimum should snap to minimum
      expect(validationFn(min - 100)).toBe(min)
      expect(validationFn(0)).toBe(min)
      expect(validationFn(-10)).toBe(min)

      // Values above maximum should snap to maximum
      expect(validationFn(max + 100)).toBe(max)
      expect(validationFn(1000)).toBe(max)
    })
  })
}

/**
 * Tests validation functions that apply rounding
 * @param {Function} validationFn - The validation function to test
 * @param {Object} config - Test configuration with rounding cases
 * @example
 * testRoundingValidation(validateTextSize, {
 *   roundingCases: [[75.4, 75], [75.5, 76], [100.1, 100]],
 *   functionName: 'validateTextSize'
 * })
 */
export function testRoundingValidation(
  validationFn: (value: any) => number,
  config: {
    roundingCases: Array<[number, number]>
    functionName?: string
  }
): void {
  const fnName = config.functionName || 'rounding validation function'

  describe(`${fnName} - rounding behavior`, () => {
    it('should round values to nearest integer', () => {
      config.roundingCases.forEach(([input, expected]) => {
        expect(validationFn(input)).toBe(expected)
      })
    })
  })
}
