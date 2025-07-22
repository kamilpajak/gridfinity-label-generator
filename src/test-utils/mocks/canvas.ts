/**
 * @fileoverview Mock implementations for Canvas API used in tests
 * @module test-utils/mocks/canvas
 */

import { vi } from 'vitest'

/**
 * Mock implementation of CanvasRenderingContext2D
 * @class MockCanvasRenderingContext2D
 */
export class MockCanvasRenderingContext2D {
  fillStyle: string = ''
  font: string = ''
  textBaseline: string = ''
  canvas: HTMLCanvasElement

  constructor() {
    this.canvas = {
      width: 0,
      height: 0,
      toDataURL: () => 'mock-data-url',
    } as unknown as HTMLCanvasElement
  }

  /**
   * Mock fillRect method
   * @param {number} _x - X coordinate (unused in mock)
   * @param {number} _y - Y coordinate (unused in mock)
   * @param {number} _width - Rectangle width (unused in mock)
   * @param {number} _height - Rectangle height (unused in mock)
   */
  fillRect(_x: number, _y: number, _width: number, _height: number): void {
    // Intentionally empty - mock implementation for testing
  }

  /**
   * Mock fillText method
   * @param {string} _text - Text to draw (unused in mock)
   * @param {number} _x - X coordinate (unused in mock)
   * @param {number} _y - Y coordinate (unused in mock)
   */
  fillText(_text: string, _x: number, _y: number): void {
    // Intentionally empty - mock implementation for testing
  }

  /**
   * Mock measureText method that returns reasonable values
   * @param {string} text - The text to measure
   * @returns {TextMetrics} Mock text metrics
   */
  measureText(text: string): TextMetrics {
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 5,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 10,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 6,
    } as TextMetrics
  }

  /**
   * Mock drawImage method
   * @param {any} _image - Image to draw (unused in mock)
   * @param {number} _dx - Destination X (unused in mock)
   * @param {number} _dy - Destination Y (unused in mock)
   * @param {number} _dw - Destination width (unused in mock)
   * @param {number} _dh - Destination height (unused in mock)
   */
  drawImage(_image: any, _dx: number, _dy: number, _dw?: number, _dh?: number): void {
    // Intentionally empty - mock implementation for testing
  }
}

/**
 * Creates a mock canvas element
 * @returns {HTMLCanvasElement} Mock canvas element
 */
export function createMockCanvas(): HTMLCanvasElement {
  return {
    getContext: () => new MockCanvasRenderingContext2D(),
    width: 0,
    height: 0,
    toDataURL: () => 'mock-data-url',
  } as unknown as HTMLCanvasElement
}

/**
 * Mock Image class for tests
 */
export class MockImage {
  onload: () => void = () => {
    // Intentionally empty - callback for testing
  }
  onerror: () => void = () => {
    // Intentionally empty - callback for testing
  }
  src: string = ''
  complete: boolean = true
  naturalWidth: number = 100
  naturalHeight: number = 100
  crossOrigin: string = ''

  constructor() {
    setTimeout(() => this.onload(), 0)
  }
}

/**
 * Canvas test setup configuration
 * @typedef {Object} CanvasTestSetup
 * @property {Function} createElement - Original createElement function
 * @property {any} Image - Original Image constructor
 * @property {HTMLCanvasElement} mockCanvas - Mock canvas instance
 */
interface CanvasTestSetup {
  createElement: typeof document.createElement
  Image: typeof Image
  mockCanvas: HTMLCanvasElement
}

/**
 * Sets up canvas mocks for testing
 * @returns {CanvasTestSetup} Setup configuration for cleanup
 * @example
 * beforeEach(() => {
 *   const setup = setupCanvasMocks()
 *   // Store setup for cleanup
 * })
 */
export function setupCanvasMocks(): CanvasTestSetup {
  const originalCreateElement = document.createElement
  const originalImage = global.Image
  const mockCanvas = createMockCanvas()

  // Mock document.createElement to return our mock canvas
  document.createElement = vi.fn().mockImplementation(tagName => {
    if (tagName === 'canvas') {
      return mockCanvas
    }
    return originalCreateElement.call(document, tagName)
  })

  // Mock Image constructor
  global.Image = MockImage as any

  // Mock console.log to avoid cluttering test output
  console.log = vi.fn()

  return {
    createElement: originalCreateElement,
    Image: originalImage,
    mockCanvas,
  }
}

/**
 * Cleans up canvas mocks after testing
 * @param {CanvasTestSetup} setup - Setup configuration from setupCanvasMocks
 * @example
 * afterEach(() => {
 *   cleanupCanvasMocks(setup)
 *   vi.clearAllMocks()
 * })
 */
export function cleanupCanvasMocks(setup: CanvasTestSetup): void {
  document.createElement = setup.createElement
  global.Image = setup.Image

  // Reset canvas dimensions
  setup.mockCanvas.width = 0
  setup.mockCanvas.height = 0
}

/**
 * Mock implementation for QR code generation
 * @returns {Object} Mock QR code module
 */
export function createQRCodeMock() {
  return {
    default: {
      toDataURL: vi.fn().mockResolvedValue('mock-qr-code-data-url'),
    },
  }
}

/**
 * Creates a mock for document.fonts API
 * @returns {Object} Mock fonts API
 */
export function createFontsMock() {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    ready: Promise.resolve(),
    check: vi.fn().mockReturnValue(true),
  }
}
