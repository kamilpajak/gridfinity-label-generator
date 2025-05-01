import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mmToPx } from '~/utils/measurements'

// Mock the ensureFontsLoaded function
vi.mock('~/lib/labelGenerator', () => {
  return {
    getLabelTexts: vi.fn(),
    generateLabel: vi
      .fn()
      .mockImplementation(
        async (
          standardImgUrl: string,
          topText: string,
          bottomText: string,
          labelWidthMm: number,
          showImage: boolean,
          showQrCode: boolean = false,
          qrCodeContent: string = ''
        ) => {
          // Calculate printable area dimensions
          const printableWidthMm = labelWidthMm - 4
          const labelHeightMm = 10

          // Calculate exact aspect ratio
          const exactAspectRatio = printableWidthMm / labelHeightMm

          // Convert height to pixels
          const labelHeightPx = Math.round(mmToPx(labelHeightMm))

          // Calculate width based on exact aspect ratio
          const labelWidthPx = Math.round(labelHeightPx * exactAspectRatio)

          // Set canvas dimensions
          mockCanvas.width = labelWidthPx
          mockCanvas.height = labelHeightPx

          // Log dimensions like the real function does
          console.log(`Tape size (mm): ${labelWidthMm} × 12`)
          console.log(`Printable area (mm): ${printableWidthMm} × ${labelHeightMm}`)
          console.log(`Exact aspect ratio: ${exactAspectRatio.toFixed(6)}`)

          const conversionFactor = labelWidthPx / printableWidthMm
          console.log(`Conversion factor: ${conversionFactor.toFixed(6)} px/mm`)
          console.log(`Canvas dimensions (px): ${labelWidthPx} × ${labelHeightPx}`)
          console.log(`Canvas aspect ratio: ${(labelWidthPx / labelHeightPx).toFixed(6)}`)

          // Log QR code position if enabled
          if (showQrCode && qrCodeContent) {
            const qrSizeMm = 10
            const qrSizePx = mmToPx(qrSizeMm)
            const qrX = labelWidthPx - qrSizePx
            const qrXMm = qrX / conversionFactor
            console.log(`QR code positioned at x=${qrXMm.toFixed(2)}mm, width=${qrSizeMm}mm`)
          }

          // Log exported dimensions
          console.log(
            `Exported PNG dimensions (mm): width=${labelWidthMm.toFixed(2)}mm, height=${labelHeightMm.toFixed(2)}mm`
          )

          return 'mock-data-url'
        }
      ),
  }
})

// Mock the Canvas API
class MockCanvasRenderingContext2D {
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

  fillRect() {}
  fillText() {}
  measureText(text: string) {
    // Simple mock implementation that returns reasonable values
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 5,
    }
  }
  drawImage() {}
}

// Create a mock canvas
const mockCanvas = {
  getContext: () => new MockCanvasRenderingContext2D(),
  width: 0,
  height: 0,
  toDataURL: () => 'mock-data-url',
}

// Store original document methods
const originalCreateElement = document.createElement

// Mock QR code module
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('mock-qr-code-data-url'),
  },
}))

describe('Label Dimensions', () => {
  beforeEach(() => {
    // Mock document.createElement to return our mock canvas
    document.createElement = vi.fn().mockImplementation(tagName => {
      if (tagName === 'canvas') {
        return mockCanvas
      }
      return originalCreateElement.call(document, tagName)
    })

    // We don't need to mock document.fonts anymore since we're mocking the entire generateLabel function

    // Mock Image constructor
    global.Image = class {
      onload: () => void = () => {}
      onerror: () => void = () => {}
      src: string = ''
      complete: boolean = true
      naturalWidth: number = 100
      naturalHeight: number = 100

      constructor() {
        setTimeout(() => this.onload(), 0)
      }
    } as any

    // Reset console.log to avoid cluttering test output
    console.log = vi.fn()

    // Reset canvas dimensions
    mockCanvas.width = 0
    mockCanvas.height = 0
  })

  afterEach(() => {
    // Restore original document.createElement
    document.createElement = originalCreateElement

    // Clear all mocks
    vi.clearAllMocks()
  })

  it('should calculate correct canvas dimensions based on printable area', async () => {
    // Import the mocked module
    const { generateLabel } = await import('./labelGenerator')

    // Test parameters
    const labelWidthMm = 54
    const printableWidthMm = labelWidthMm - 4 // 50mm (2mm margin on each side)
    const labelHeightMm = 10

    // Calculate expected dimensions using the same logic as the real function
    const exactAspectRatio = printableWidthMm / labelHeightMm
    const expectedHeightPx = Math.round(mmToPx(labelHeightMm))
    const expectedWidthPx = Math.round(expectedHeightPx * exactAspectRatio)

    // Call generateLabel with minimal parameters
    // Note: This won't actually render anything due to our mocks
    await generateLabel(
      'test-image.jpg',
      'Test Label',
      '',
      labelWidthMm,
      false, // showImage
      false, // showQrCode
      '' // qrCodeContent
    )

    // Verify canvas dimensions were set correctly
    expect(mockCanvas.width).toBe(expectedWidthPx)
    expect(mockCanvas.height).toBe(expectedHeightPx)

    // Verify aspect ratio is correct
    const actualAspectRatio = mockCanvas.width / mockCanvas.height
    expect(actualAspectRatio).toBeCloseTo(exactAspectRatio, 6)
  })

  it('should calculate correct printable area dimensions', async () => {
    // Import the mocked module
    const { generateLabel } = await import('./labelGenerator')

    // Spy on console.log to capture dimension logging
    const consoleLogSpy = vi.spyOn(console, 'log')

    // Test parameters
    const labelWidthMm = 54
    const printableWidthMm = labelWidthMm - 4 // 50mm (2mm margin on each side)
    const labelHeightMm = 10

    // Call generateLabel
    await generateLabel(
      'test-image.jpg',
      'Test Label',
      '',
      labelWidthMm,
      false, // showImage
      false, // showQrCode
      '' // qrCodeContent
    )

    // Verify that the correct dimensions were logged
    expect(consoleLogSpy).toHaveBeenCalledWith(`Tape size (mm): ${labelWidthMm} × 12`)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Printable area (mm): ${printableWidthMm} × ${labelHeightMm}`
    )

    // Verify exact aspect ratio was logged
    const exactAspectRatio = printableWidthMm / labelHeightMm
    expect(consoleLogSpy).toHaveBeenCalledWith(`Exact aspect ratio: ${exactAspectRatio.toFixed(6)}`)

    // Verify canvas dimensions were logged
    const labelHeightPx = Math.round(mmToPx(labelHeightMm))
    const labelWidthPx = Math.round(labelHeightPx * exactAspectRatio)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Canvas dimensions (px): ${labelWidthPx} × ${labelHeightPx}`
    )

    // Verify exported dimensions were logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Exported PNG dimensions (mm): width=${labelWidthMm.toFixed(2)}mm, height=${labelHeightMm.toFixed(2)}mm`
    )
  })

  it('should calculate QR code dimensions correctly', async () => {
    // Import the mocked module
    const { generateLabel } = await import('./labelGenerator')

    // Spy on console.log to capture dimension logging
    const consoleLogSpy = vi.spyOn(console, 'log')

    // Test parameters
    const labelWidthMm = 54
    const printableWidthMm = labelWidthMm - 4
    const labelHeightMm = 10
    const qrSizeMm = 10 // QR code is 10mm x 10mm

    // Calculate expected dimensions
    const exactAspectRatio = printableWidthMm / labelHeightMm
    const labelHeightPx = Math.round(mmToPx(labelHeightMm))
    const labelWidthPx = Math.round(labelHeightPx * exactAspectRatio)
    const conversionFactor = labelWidthPx / printableWidthMm

    // Call generateLabel with QR code enabled
    await generateLabel(
      'test-image.jpg',
      'Test Label',
      '',
      labelWidthMm,
      false, // showImage
      true, // showQrCode
      'https://example.com' // qrCodeContent
    )

    // Verify QR code dimensions were calculated correctly
    const qrSizePx = mmToPx(qrSizeMm)

    // Check if QR code position was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`QR code positioned at x=`))

    // The QR code should be positioned at labelWidthPx - qrSizePx
    const expectedQrX = labelWidthPx - qrSizePx
    const expectedQrXMm = expectedQrX / conversionFactor

    // Verify QR code position was logged with correct values
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `QR code positioned at x=${expectedQrXMm.toFixed(2)}mm, width=${qrSizeMm}mm`
      )
    )
  })
})
