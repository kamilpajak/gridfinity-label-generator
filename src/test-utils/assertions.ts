/**
 * @fileoverview Custom assertion utilities for testing
 * @module test-utils/assertions
 */

import { expect } from 'vitest'

/**
 * Assert that a value is within a range
 * @param {number} actual - The actual value
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} [message] - Optional error message
 * @example
 * assertInRange(50, 40, 60) // passes
 * assertInRange(30, 40, 60) // fails
 */
export function assertInRange(actual: number, min: number, max: number, message?: string): void {
  const errorMessage = message || `Expected ${actual} to be between ${min} and ${max}`
  expect(actual >= min && actual <= max, errorMessage).toBe(true)
}

/**
 * Assert that two values are approximately equal within a tolerance
 * @param {number} actual - The actual value
 * @param {number} expected - The expected value
 * @param {number} [tolerance=0.01] - Tolerance for comparison
 * @param {string} [message] - Optional error message
 * @example
 * assertApproximatelyEqual(3.14159, 3.14, 0.01) // passes
 * assertApproximatelyEqual(3.14159, 3.14, 0.001) // fails
 */
export function assertApproximatelyEqual(
  actual: number,
  expected: number,
  tolerance: number = 0.01,
  message?: string
): void {
  const errorMessage =
    message || `Expected ${actual} to be approximately ${expected} (within ${tolerance})`
  expect(Math.abs(actual - expected) <= tolerance, errorMessage).toBe(true)
}

/**
 * Assert that a value is one of the allowed values
 * @param {T} actual - The actual value
 * @param {T[]} allowedValues - Array of allowed values
 * @param {string} [message] - Optional error message
 * @example
 * assertOneOf(12, [9, 12, 18, 24]) // passes
 * assertOneOf(15, [9, 12, 18, 24]) // fails
 */
export function assertOneOf<T>(actual: T, allowedValues: readonly T[], message?: string): void {
  const errorMessage = message || `Expected ${actual} to be one of [${allowedValues.join(', ')}]`
  expect(allowedValues.includes(actual), errorMessage).toBe(true)
}

/**
 * Assert that dimensions match expected values
 * @param {Object} actual - Actual dimensions object
 * @param {Object} expected - Expected dimensions object
 * @param {string} [message] - Optional error message
 * @example
 * assertDimensions(
 *   { width: 50, height: 10 },
 *   { width: 50, height: 10 }
 * ) // passes
 */
export function assertDimensions(
  actual: { width: number; height: number },
  expected: { width: number; height: number },
  message?: string
): void {
  if (message) {
    expect(actual.width, message).toBe(expected.width)
    expect(actual.height, message).toBe(expected.height)
  } else {
    expect(actual.width).toBe(expected.width)
    expect(actual.height).toBe(expected.height)
  }
}

/**
 * Assert that a CSS class string contains all expected classes
 * @param {string} actual - Actual CSS class string
 * @param {string[]} expectedClasses - Array of expected class names
 * @param {string} [message] - Optional error message
 * @example
 * assertHasClasses('btn btn-primary active', ['btn', 'active']) // passes
 * assertHasClasses('btn btn-primary', ['btn', 'active']) // fails
 */
export function assertHasClasses(
  actual: string,
  expectedClasses: string[],
  message?: string
): void {
  const actualClasses = actual.split(' ').filter(Boolean)
  expectedClasses.forEach(className => {
    const errorMessage =
      message || `Expected class string "${actual}" to contain class "${className}"`
    expect(actualClasses.includes(className), errorMessage).toBe(true)
  })
}

/**
 * Assert that a CSS class string doesn't contain any of the specified classes
 * @param {string} actual - Actual CSS class string
 * @param {string[]} unexpectedClasses - Array of class names that shouldn't be present
 * @param {string} [message] - Optional error message
 * @example
 * assertNotHasClasses('btn btn-primary', ['active', 'disabled']) // passes
 * assertNotHasClasses('btn btn-primary active', ['active']) // fails
 */
export function assertNotHasClasses(
  actual: string,
  unexpectedClasses: string[],
  message?: string
): void {
  const actualClasses = actual.split(' ').filter(Boolean)
  unexpectedClasses.forEach(className => {
    const errorMessage =
      message || `Expected class string "${actual}" not to contain class "${className}"`
    expect(!actualClasses.includes(className), errorMessage).toBe(true)
  })
}

/**
 * Assert that a value increases monotonically across test cases
 * @param {number[]} values - Array of values to check
 * @param {string} [message] - Optional error message
 * @example
 * assertMonotonicIncrease([1, 2, 3, 4]) // passes
 * assertMonotonicIncrease([1, 3, 2, 4]) // fails
 */
export function assertMonotonicIncrease(values: number[], message?: string): void {
  for (let i = 1; i < values.length; i++) {
    const errorMessage =
      message ||
      `Expected monotonic increase, but ${values[i]} is not greater than ${values[i - 1]}`
    expect(values[i] > values[i - 1], errorMessage).toBe(true)
  }
}

/**
 * Assert that a value decreases monotonically across test cases
 * @param {number[]} values - Array of values to check
 * @param {string} [message] - Optional error message
 * @example
 * assertMonotonicDecrease([4, 3, 2, 1]) // passes
 * assertMonotonicDecrease([4, 2, 3, 1]) // fails
 */
export function assertMonotonicDecrease(values: number[], message?: string): void {
  for (let i = 1; i < values.length; i++) {
    const errorMessage =
      message || `Expected monotonic decrease, but ${values[i]} is not less than ${values[i - 1]}`
    expect(values[i] < values[i - 1], errorMessage).toBe(true)
  }
}

/**
 * Assert that an object has all required properties
 * @param {Object} obj - Object to check
 * @param {string[]} requiredProps - Array of required property names
 * @param {string} [message] - Optional error message
 * @example
 * assertHasProperties(
 *   { width: 50, height: 10, color: 'red' },
 *   ['width', 'height']
 * ) // passes
 */
export function assertHasProperties(
  obj: Record<string, any>,
  requiredProps: string[],
  message?: string
): void {
  requiredProps.forEach(prop => {
    const errorMessage = message || `Expected object to have property "${prop}"`
    expect(Object.hasOwn(obj, prop), errorMessage).toBe(true)
  })
}

/**
 * Assert that a string matches a pattern
 * @param {string} actual - Actual string
 * @param {RegExp} pattern - Regular expression pattern
 * @param {string} [message] - Optional error message
 * @example
 * assertMatchesPattern('M5 × 20', /M\d+ × \d+/) // passes
 * assertMatchesPattern('Invalid', /M\d+ × \d+/) // fails
 */
export function assertMatchesPattern(actual: string, pattern: RegExp, message?: string): void {
  const errorMessage = message || `Expected "${actual}" to match pattern ${pattern}`
  expect(pattern.test(actual), errorMessage).toBe(true)
}

/**
 * Assert that a function throws an error matching expectations
 * @param {Function} fn - Function to test
 * @param {RegExp | string} [expectedError] - Expected error message or pattern
 * @param {string} [message] - Optional error message
 * @example
 * assertThrows(() => { throw new Error('Test error') }, 'Test error') // passes
 * assertThrows(() => { throw new Error('Test error') }, /Test/) // passes
 */
export function assertThrows(
  fn: () => void,
  expectedError?: RegExp | string,
  message?: string
): void {
  let thrown = false
  let actualError: Error | null = null

  try {
    fn()
  } catch (e) {
    thrown = true
    actualError = e as Error
  }

  const baseMessage = message || 'Expected function to throw'
  expect(thrown, `${baseMessage}, but it didn't`).toBe(true)

  if (expectedError && actualError) {
    if (typeof expectedError === 'string') {
      expect(actualError.message).toBe(expectedError)
    } else {
      expect(
        expectedError.test(actualError.message),
        `${baseMessage} matching ${expectedError}, but got "${actualError.message}"`
      ).toBe(true)
    }
  }
}

/**
 * Helper type for custom matchers
 */
export interface CustomMatchers {
  toBeInRange(min: number, max: number): void
  toBeApproximatelyEqual(expected: number, tolerance?: number): void
  toBeOneOf<T>(allowedValues: readonly T[]): void
  toHaveClasses(expectedClasses: string[]): void
  toNotHaveClasses(unexpectedClasses: string[]): void
  toMatchPattern(pattern: RegExp): void
}

/**
 * Extend Vitest's expect with custom matchers
 * Call this in your test setup file
 * @example
 * // In your test setup file
 * import { extendExpect } from '~/test-utils/assertions'
 * extendExpect()
 *
 * // Then in tests
 * expect(50).toBeInRange(40, 60)
 */
export function extendExpect(): void {
  expect.extend({
    toBeInRange(received: number, min: number, max: number) {
      const pass = received >= min && received <= max
      if (pass) {
        return {
          message: () => `expected ${received} not to be between ${min} and ${max}`,
          pass: true,
        }
      } else {
        return {
          message: () => `expected ${received} to be between ${min} and ${max}`,
          pass: false,
        }
      }
    },

    toBeApproximatelyEqual(received: number, expected: number, tolerance: number = 0.01) {
      const pass = Math.abs(received - expected) <= tolerance
      if (pass) {
        return {
          message: () =>
            `expected ${received} not to be approximately ${expected} (within ${tolerance})`,
          pass: true,
        }
      } else {
        return {
          message: () =>
            `expected ${received} to be approximately ${expected} (within ${tolerance})`,
          pass: false,
        }
      }
    },

    toBeOneOf<T>(received: T, allowedValues: readonly T[]) {
      const pass = allowedValues.includes(received)
      if (pass) {
        return {
          message: () => `expected ${received} not to be one of [${allowedValues.join(', ')}]`,
          pass: true,
        }
      } else {
        return {
          message: () => `expected ${received} to be one of [${allowedValues.join(', ')}]`,
          pass: false,
        }
      }
    },

    toHaveClasses(received: string, expectedClasses: string[]) {
      const actualClasses = received.split(' ').filter(Boolean)
      const missingClasses = expectedClasses.filter(c => !actualClasses.includes(c))
      const pass = missingClasses.length === 0

      if (pass) {
        return {
          message: () =>
            `expected "${received}" not to have classes [${expectedClasses.join(', ')}]`,
          pass: true,
        }
      } else {
        return {
          message: () => `expected "${received}" to have classes [${missingClasses.join(', ')}]`,
          pass: false,
        }
      }
    },

    toNotHaveClasses(received: string, unexpectedClasses: string[]) {
      const actualClasses = received.split(' ').filter(Boolean)
      const foundClasses = unexpectedClasses.filter(c => actualClasses.includes(c))
      const pass = foundClasses.length === 0

      if (pass) {
        return {
          message: () =>
            `expected "${received}" to have some of classes [${unexpectedClasses.join(', ')}]`,
          pass: true,
        }
      } else {
        return {
          message: () => `expected "${received}" not to have classes [${foundClasses.join(', ')}]`,
          pass: false,
        }
      }
    },

    toMatchPattern(received: string, pattern: RegExp) {
      const pass = pattern.test(received)
      if (pass) {
        return {
          message: () => `expected "${received}" not to match pattern ${pattern}`,
          pass: true,
        }
      } else {
        return {
          message: () => `expected "${received}" to match pattern ${pattern}`,
          pass: false,
        }
      }
    },
  })
}
