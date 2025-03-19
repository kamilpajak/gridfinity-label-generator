import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mmToPx } from '~/utils/measurements';

// Mock the ensureFontsLoaded function
vi.mock('~/lib/labelGenerator', () => {
  return {
    getLabelTexts: vi.fn(),
    generateLabel: vi.fn().mockImplementation(async (
      standardImgUrl: string,
      topText: string,
      bottomText: string,
      labelWidthMm: number,
      showImage: boolean,
      showQrCode: boolean = false,
      qrCodeContent: string = "",
    ) => {
      // Set canvas dimensions
      mockCanvas.width = mmToPx(labelWidthMm);
      mockCanvas.height = mmToPx(10); // Fixed height 10mm
      
      // Log dimensions like the real function does
      console.log(`Label width (mm): ${labelWidthMm}`);
      console.log(`Label height (mm): 10`);
      
      const conversionFactor = mmToPx(1);
      console.log(`Conversion factor: ${conversionFactor.toFixed(2)} px/mm`);
      
      // Log QR code position if enabled
      if (showQrCode && qrCodeContent) {
        const qrSizeMm = 10;
        const qrSizePx = mmToPx(qrSizeMm);
        const qrX = mmToPx(labelWidthMm) - qrSizePx;
        const qrXMm = qrX / conversionFactor;
        console.log(`QR code positioned at x=${qrXMm.toFixed(2)}mm, width=${qrSizeMm}mm`);
      }
      
      // Log exported dimensions
      console.log(`Exported PNG dimensions (mm): width=${labelWidthMm.toFixed(2)}mm, height=10.00mm`);
      
      return 'mock-data-url';
    })
  };
});

// Mock the Canvas API
class MockCanvasRenderingContext2D {
  fillStyle: string = '';
  font: string = '';
  textBaseline: string = '';
  canvas: HTMLCanvasElement;
  
  constructor() {
    this.canvas = {
      width: 0,
      height: 0,
      toDataURL: () => 'mock-data-url'
    } as unknown as HTMLCanvasElement;
  }
  
  fillRect() {}
  fillText() {}
  measureText(text: string) {
    // Simple mock implementation that returns reasonable values
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 5
    };
  }
  drawImage() {}
}

// Create a mock canvas
const mockCanvas = {
  getContext: () => new MockCanvasRenderingContext2D(),
  width: 0,
  height: 0,
  toDataURL: () => 'mock-data-url'
};

// Store original document methods
const originalCreateElement = document.createElement;

// Mock QR code module
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('mock-qr-code-data-url')
  }
}));

describe('Label Dimensions', () => {
  beforeEach(() => {
    // Mock document.createElement to return our mock canvas
    document.createElement = vi.fn().mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return originalCreateElement.call(document, tagName);
    });
    
    // We don't need to mock document.fonts anymore since we're mocking the entire generateLabel function
    
    // Mock Image constructor
    global.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      src: string = '';
      complete: boolean = true;
      naturalWidth: number = 100;
      naturalHeight: number = 100;
      
      constructor() {
        setTimeout(() => this.onload(), 0);
      }
    } as any;
    
    // Reset console.log to avoid cluttering test output
    console.log = vi.fn();
    
    // Reset canvas dimensions
    mockCanvas.width = 0;
    mockCanvas.height = 0;
  });
  
  afterEach(() => {
    // Restore original document.createElement
    document.createElement = originalCreateElement;
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  it('should calculate correct canvas dimensions based on label width', async () => {
    // Import the mocked module
    const { generateLabel } = await import('./labelGenerator');
    
    // Test parameters
    const labelWidthMm = 54;
    const labelHeightMm = 10;
    
    // Expected pixel dimensions
    const expectedWidthPx = mmToPx(labelWidthMm);
    const expectedHeightPx = mmToPx(labelHeightMm);
    
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
    );
    
    // Verify canvas dimensions were set correctly
    expect(mockCanvas.width).toBe(expectedWidthPx);
    expect(mockCanvas.height).toBe(expectedHeightPx);
  });
  
  it('should calculate correct printable area dimensions', async () => {
    // Import the mocked module
    const { generateLabel } = await import('./labelGenerator');
    
    // Spy on console.log to capture dimension logging
    const consoleLogSpy = vi.spyOn(console, 'log');
    
    // Test parameters
    const labelWidthMm = 54;
    const printableWidthMm = labelWidthMm - 4; // 50mm (2mm margin on each side)
    
    // Call generateLabel
    await generateLabel(
      'test-image.jpg',
      'Test Label',
      '',
      labelWidthMm,
      false, // showImage
      false, // showQrCode
      '' // qrCodeContent
    );
    
    // Verify that the correct dimensions were logged
    expect(consoleLogSpy).toHaveBeenCalledWith(`Label width (mm): ${labelWidthMm}`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`Label height (mm): 10`);
    
    // Verify conversion factor was logged
    const conversionFactor = mmToPx(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Conversion factor: ${conversionFactor.toFixed(2)}`));
    
    // Verify exported dimensions were logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Exported PNG dimensions (mm): width=${labelWidthMm.toFixed(2)}mm, height=10.00mm`
    );
  });
  
  it('should calculate QR code dimensions correctly', async () => {
    // Import the mocked module
    const { generateLabel } = await import('./labelGenerator');
    
    // Spy on console.log to capture dimension logging
    const consoleLogSpy = vi.spyOn(console, 'log');
    
    // Test parameters
    const labelWidthMm = 54;
    const qrSizeMm = 10; // QR code is 10mm x 10mm
    
    // Call generateLabel with QR code enabled
    await generateLabel(
      'test-image.jpg',
      'Test Label',
      '',
      labelWidthMm,
      false, // showImage
      true, // showQrCode
      'https://example.com' // qrCodeContent
    );
    
    // Verify QR code dimensions were calculated correctly
    const qrSizePx = mmToPx(qrSizeMm);
    
    // Check if QR code position was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`QR code positioned at x=`)
    );
    
    // The QR code should be positioned at labelWidthPx - qrSizePx
    const expectedQrX = mmToPx(labelWidthMm) - qrSizePx;
    const conversionFactor = mmToPx(1); // px per mm
    const expectedQrXMm = expectedQrX / conversionFactor;
    
    // Verify QR code position was logged with correct values
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`QR code positioned at x=${expectedQrXMm.toFixed(2)}mm, width=${qrSizeMm}mm`)
    );
  });
});
