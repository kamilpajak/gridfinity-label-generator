import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderLabelToCanvas, clearRenderCaches } from './label-renderer';
import type { SolverOutput } from './label-constraint-solver';

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

// Mock Image base class
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

// Factory functions for mock Image classes (extracted to reduce nesting depth)
function createMockImageThatLoads(width = 100, height = 100) {
	return class extends MockImage {
		constructor() {
			super();
			this.width = width;
			this.height = height;
			setTimeout(() => this.onload?.(), 0);
		}
	} as unknown as typeof Image;
}

function createMockImageThatFails() {
	return class extends MockImage {
		constructor() {
			super();
			setTimeout(() => this.onerror?.(new Event('error')), 0);
		}
	} as unknown as typeof Image;
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
		globalThis.Image = MockImage as unknown as typeof Image;
		globalThis.document = {
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

	describe('image rendering', () => {
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

		it('should draw image at exact dimensions from constraint solver', async () => {
			globalThis.Image = createMockImageThatLoads(100, 200);

			await renderLabelToCanvas(baseOptions);

			// Renderer should use exact dimensions from constraint solver
			// No aspect ratio recalculation happens in renderer
			expect(mockContext.drawImage).toHaveBeenCalledWith(
				expect.any(MockImage),
				1, // x position from layout
				2, // y position from layout
				6, // width from layout
				6 // height from layout
			);
		});

		it('should apply scale factor to all dimensions', async () => {
			const scaledOptions = {
				...baseOptions,
				scale: 2
			};

			globalThis.Image = createMockImageThatLoads(100, 200);

			await renderLabelToCanvas(scaledOptions);

			// Scale factor multiplies all layout dimensions
			expect(mockContext.drawImage).toHaveBeenCalledWith(
				expect.any(MockImage),
				1 * 2, // x * scale
				2 * 2, // y * scale
				6 * 2, // width * scale
				6 * 2 // height * scale
			);
		});

		it('should draw images with varying aspect ratios at provided dimensions', async () => {
			// The renderer doesn't care about source image aspect ratio
			// It just draws at the dimensions provided by the constraint solver
			const testCases = [
				{ width: 50, height: 300 }, // Very tall
				{ width: 300, height: 50 }, // Very wide
				{ width: 1000, height: 1000 }, // Large square
				{ width: 10, height: 10 } // Small square
			];

			for (const testCase of testCases) {
				vi.clearAllMocks();

				globalThis.Image = createMockImageThatLoads(testCase.width, testCase.height);

				await renderLabelToCanvas(baseOptions);

				// All images drawn at same dimensions regardless of source aspect ratio
				expect(mockContext.drawImage).toHaveBeenCalledWith(expect.any(MockImage), 1, 2, 6, 6);
			}
		});

		it('should render label without throwing when image fails to load (graceful degradation)', async () => {
			globalThis.Image = createMockImageThatFails();

			// Should not throw - graceful degradation
			await expect(renderLabelToCanvas(baseOptions)).resolves.not.toThrow();

			// Text should still be rendered
			expect(mockContext.fillText).toHaveBeenCalled();
		});

		it('should render label when customImageSrc is provided', async () => {
			globalThis.Image = createMockImageThatLoads(100, 100);

			const optionsWithCustomImage = {
				...baseOptions,
				content: {
					...baseOptions.content,
					standard: undefined,
					customImageSrc: 'data:image/png;base64,abc123',
					showHardwareImage: true
				}
			};

			await renderLabelToCanvas(optionsWithCustomImage);

			// Image should be drawn using customImageSrc
			expect(mockContext.drawImage).toHaveBeenCalled();
		});
	});
});
