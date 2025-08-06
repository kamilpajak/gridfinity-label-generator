import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderLabelToCanvas, clearRenderCaches } from './label-renderer';
import type { SolverOutput } from './label-constraint-solver';
import type { ISODINStandard } from '$lib/data/standards';

// Mock canvas context
const mockContext = {
	save: vi.fn(),
	restore: vi.fn(),
	clearRect: vi.fn(),
	fillRect: vi.fn(),
	drawImage: vi.fn(),
	fillText: vi.fn(),
	translate: vi.fn(),
	strokeRect: vi.fn(),
	setLineDash: vi.fn(),
	setTransform: vi.fn(),
	fillStyle: '',
	strokeStyle: '',
	lineWidth: 0,
	font: '',
	textAlign: '',
	textBaseline: ''
};

const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => mockContext)
};

// Mock Image
class MockImage {
	onload: (() => void) | null = null;
	onerror: ((e: Event) => void) | null = null;
	src = '';
	width = 0;
	height = 0;

	constructor() {
		// Set default dimensions for testing
		this.width = 100;
		this.height = 200;
	}
}

// Mock document.fonts
const mockFonts = {
	load: vi.fn(() => Promise.resolve())
};

// Mock QRCode
vi.mock('qrcode', () => ({
	default: {
		toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock'))
	}
}));

// Mock URL shortener
vi.mock('./url-shortener', () => ({
	shortenUrl: vi.fn(() => Promise.resolve({ success: false })),
	shouldShortenUrl: vi.fn(() => false),
	isValidUrl: vi.fn(() => true)
}));

describe('label-renderer', () => {
	beforeEach(() => {
		global.Image = MockImage as unknown as typeof Image;
		global.document = {
			fonts: mockFonts,
			createElement: vi.fn(() => mockCanvas)
		} as unknown as Document;
		vi.clearAllMocks();
		clearRenderCaches(); // Clear image and QR caches
	});

	afterEach(() => {
		vi.restoreAllMocks();
		clearRenderCaches(); // Clear caches after each test
	});

	describe('image aspect ratio preservation', () => {
		const baseOptions = {
			canvas: mockCanvas as unknown as HTMLCanvasElement,
			dimensions: {
				width: 35,
				height: 12,
				printableWidth: 31,
				printableHeight: 10
			},
			layout: {
				primaryText: { x: 10, y: 5 },
				secondaryText: { x: 10, y: 8 },
				hardwareImage: { x: 1, y: 2, width: 6, height: 6 },
				qrCode: undefined,
				primaryFontSize: 3,
				secondaryFontSize: 2,
				textClipWidth: 20
			} as SolverOutput,
			content: {
				primaryText: 'Test',
				secondaryText: 'Test',
				standard: {
					id: 'hex',
					image: '/images/hex.svg',
					description: 'Hex nut',
					designations: [],
					primarySystem: 'ISO' as const
				},
				showStandard: true,
				showHardwareImage: true,
				showQRCode: false
			}
		};

		it('should maintain aspect ratio when image is taller than wide', async () => {
			// Set up image that is taller than wide (aspect ratio 1:2)
			const mockImg = new MockImage();
			mockImg.width = 100;
			mockImg.height = 200;

			// Override Image constructor for this test
			global.Image = class extends MockImage {
				constructor() {
					super();
					this.width = 100;
					this.height = 200;
					setTimeout(() => {
						if (this.onload) this.onload();
					}, 0);
				}
			} as unknown as typeof Image;

			await renderLabelToCanvas(baseOptions);

			// Image should be scaled to fit height, maintaining aspect ratio
			// Available space: 6x6
			// Image aspect ratio: 1:2 (width:height)
			// To fit in 6x6 box while maintaining aspect ratio:
			// Height = 6, Width = 6 * (100/200) = 3
			// Image should be centered: x offset = (6-3)/2 = 1.5
			expect(mockContext.drawImage).toHaveBeenCalledWith(
				expect.any(MockImage),
				1 + 1.5, // x position + centering offset
				2, // y position
				3, // width (maintains aspect ratio)
				6 // height (full available height)
			);
		});

		it('should maintain aspect ratio when image is wider than tall', async () => {
			// Set up image that is wider than tall (aspect ratio 2:1)
			global.Image = class extends MockImage {
				constructor() {
					super();
					this.width = 200;
					this.height = 100;
					setTimeout(() => {
						if (this.onload) this.onload();
					}, 0);
				}
			} as unknown as typeof Image;

			await renderLabelToCanvas(baseOptions);

			// Image should be scaled to fit width, maintaining aspect ratio
			// Available space: 6x6
			// Image aspect ratio: 2:1 (width:height)
			// To fit in 6x6 box while maintaining aspect ratio:
			// Width = 6, Height = 6 * (100/200) = 3
			// Image should be centered: y offset = (6-3)/2 = 1.5
			expect(mockContext.drawImage).toHaveBeenCalledWith(
				expect.any(MockImage),
				1, // x position
				2 + 1.5, // y position + centering offset
				6, // width (full available width)
				3 // height (maintains aspect ratio)
			);
		});

		it('should handle square images correctly', async () => {
			// Set up square image
			global.Image = class extends MockImage {
				constructor() {
					super();
					this.width = 150;
					this.height = 150;
					setTimeout(() => {
						if (this.onload) this.onload();
					}, 0);
				}
			} as unknown as typeof Image;

			await renderLabelToCanvas(baseOptions);

			// Square image should fill the square space exactly
			expect(mockContext.drawImage).toHaveBeenCalledWith(
				expect.any(MockImage),
				1, // x position
				2, // y position
				6, // width
				6 // height
			);
		});

		it('should apply scale factor to image dimensions and position', async () => {
			const scaledOptions = {
				...baseOptions,
				scale: 2
			};

			global.Image = class extends MockImage {
				constructor() {
					super();
					this.width = 100;
					this.height = 200;
					setTimeout(() => {
						if (this.onload) this.onload();
					}, 0);
				}
			} as unknown as typeof Image;

			await renderLabelToCanvas(scaledOptions);

			// With scale = 2, all dimensions should be doubled
			// Aspect ratio preservation: width = 3, height = 6
			// Centering offset: (6-3)/2 = 1.5
			expect(mockContext.drawImage).toHaveBeenCalledWith(
				expect.any(MockImage),
				(1 + 1.5) * 2, // (x + center offset) * scale
				2 * 2, // y * scale
				3 * 2, // width * scale
				6 * 2 // height * scale
			);
		});

		it('should not exceed the specified bounds', async () => {
			// Test with various aspect ratios
			const testCases = [
				{ width: 50, height: 300 }, // Very tall
				{ width: 300, height: 50 }, // Very wide
				{ width: 1000, height: 1000 }, // Large square
				{ width: 10, height: 10 } // Small square
			];

			for (const testCase of testCases) {
				vi.clearAllMocks();

				global.Image = class extends MockImage {
					constructor() {
						super();
						this.width = testCase.width;
						this.height = testCase.height;
						setTimeout(() => {
							if (this.onload) this.onload();
						}, 0);
					}
				} as unknown as typeof Image;

				await renderLabelToCanvas(baseOptions);

				const call = mockContext.drawImage.mock.calls[0];
				const [, x, y, width, height] = call;

				// Check that image stays within bounds
				expect(x).toBeGreaterThanOrEqual(1);
				expect(y).toBeGreaterThanOrEqual(2);
				expect(x + width).toBeLessThanOrEqual(7); // 1 + 6
				expect(y + height).toBeLessThanOrEqual(8); // 2 + 6
				expect(width).toBeLessThanOrEqual(6);
				expect(height).toBeLessThanOrEqual(6);
			}
		});
	});
});
