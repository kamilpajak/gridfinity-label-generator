/**
 * @fileoverview Central export for all test utilities
 * @module test-utils
 */

// Export all assertion utilities
export * from './assertions'

// Export all constants
export * from './constants'

// Export all validation helpers
export * from './validation.helpers'

// Export all label preview helpers
export * from './label-preview.helpers'

// Export all canvas mocks
export * from './mocks/canvas'

/**
 * Re-export commonly used utilities for convenience
 */
export {
  // Assertion utilities
  assertInRange,
  assertApproximatelyEqual,
  assertOneOf,
  assertDimensions,
  assertHasClasses,
  assertNotHasClasses,
  assertHasProperties,
  assertMatchesPattern,
  assertThrows,
  extendExpect,
} from './assertions'

export {
  // Constants
  LABEL_DIMENSIONS,
  TEXT_SIZES,
  QR_CODE,
  CANVAS,
  PRINT_CALIBRATION,
  HARDWARE_TYPES,
  VALIDATION,
  TIMING,
} from './constants'

export {
  // Validation helpers
  testValidationFunction,
  testDiscreteValidation,
  testRoundingValidation,
} from './validation.helpers'

export {
  // Label preview helpers
  checkQrCodeDisplay,
  validateLabelLayout,
  calculateDimensions,
  calculateMargins,
  generateAltText,
  getAspectRatio,
  getPlaceholderText,
  LAYOUT_CONSTANTS,
} from './label-preview.helpers'

export {
  // Canvas mocks
  MockCanvasRenderingContext2D,
  MockImage,
  createMockCanvas,
  setupCanvasMocks,
  cleanupCanvasMocks,
  createQRCodeMock,
  createFontsMock,
} from './mocks/canvas'
