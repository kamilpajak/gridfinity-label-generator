/**
 * image-utils.test.ts
 *
 * TDD tests for custom image processing utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	MAX_IMAGE_SIZE_KB,
	MAX_DIMENSION,
	MAX_UPLOAD_SIZE_MB,
	ALLOWED_TYPES,
	TRIM_THRESHOLD,
	COMPRESSION_QUALITY_MIN,
	COMPRESSION_QUALITY_PRECISION,
	validateImageFile,
	isSvgFile,
	minifySvg,
	getSvgAspectRatio,
	findContentBounds,
	compressWithBinarySearch,
	processImage
} from './image-utils';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Creates a mock File object for testing
 */
function createMockFile(name: string, type: string, size: number = 0): File {
	const content = size > 0 ? 'x'.repeat(size) : '';
	const blob = new Blob([content], { type });
	return new File([blob], name, { type });
}

/**
 * Creates ImageData with specific pixel values for testing findContentBounds
 * Pixel format: [R, G, B, A] per pixel, row by row
 */
function createImageData(width: number, height: number, pixels: number[]): ImageData {
	const data = new Uint8ClampedArray(pixels);
	return { width, height, data, colorSpace: 'srgb' as const } as ImageData;
}

/**
 * Creates a solid color image for testing
 */
function createSolidImage(
	width: number,
	height: number,
	r: number,
	g: number,
	b: number
): ImageData {
	const pixels: number[] = [];
	for (let i = 0; i < width * height; i++) {
		pixels.push(r, g, b, 255);
	}
	return createImageData(width, height, pixels);
}

// Pixel constants for compact test notation
const W = [255, 255, 255, 255] as const; // White pixel
const B = [0, 0, 0, 255] as const; // Black pixel
const T = [0, 0, 0, 0] as const; // Transparent pixel

/** Creates a pixel with custom RGBA values */
const px = (r: number, g: number, b: number, a: number = 255) => [r, g, b, a] as const;

/** Creates a row of pixels from pixel constants */
const row = (...pixels: (readonly number[])[]) => pixels.flat();

// =============================================================================
// CONSTANTS
// =============================================================================

describe('image-utils constants', () => {
	describe('MAX_IMAGE_SIZE_KB', () => {
		it('should be 100', () => {
			expect(MAX_IMAGE_SIZE_KB).toBe(100);
		});
	});

	describe('MAX_DIMENSION', () => {
		it('should be 512', () => {
			expect(MAX_DIMENSION).toBe(512);
		});
	});

	describe('MAX_UPLOAD_SIZE_MB', () => {
		it('should be 10', () => {
			expect(MAX_UPLOAD_SIZE_MB).toBe(10);
		});
	});

	describe('ALLOWED_TYPES', () => {
		it('should include image/png', () => {
			expect(ALLOWED_TYPES).toContain('image/png');
		});

		it('should include image/jpeg', () => {
			expect(ALLOWED_TYPES).toContain('image/jpeg');
		});

		it('should include image/webp', () => {
			expect(ALLOWED_TYPES).toContain('image/webp');
		});

		it('should include image/svg+xml', () => {
			expect(ALLOWED_TYPES).toContain('image/svg+xml');
		});

		it('should not include image/gif', () => {
			expect(ALLOWED_TYPES).not.toContain('image/gif');
		});

		it('should have exactly 4 allowed types', () => {
			expect(ALLOWED_TYPES).toHaveLength(4);
		});
	});

	describe('TRIM_THRESHOLD', () => {
		it('should be 10', () => {
			expect(TRIM_THRESHOLD).toBe(10);
		});
	});

	describe('COMPRESSION_QUALITY_MIN', () => {
		it('should be 0.1', () => {
			expect(COMPRESSION_QUALITY_MIN).toBe(0.1);
		});
	});

	describe('COMPRESSION_QUALITY_PRECISION', () => {
		it('should be 0.05', () => {
			expect(COMPRESSION_QUALITY_PRECISION).toBe(0.05);
		});
	});
});

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

describe('validateImageFile', () => {
	describe('valid file types', () => {
		it.each([
			['PNG', 'test.png', 'image/png'],
			['JPEG', 'test.jpg', 'image/jpeg'],
			['WebP', 'test.webp', 'image/webp'],
			['SVG', 'test.svg', 'image/svg+xml']
		])('accepts %s files', (_, filename, mimeType) => {
			const file = createMockFile(filename, mimeType);
			const result = validateImageFile(file);
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe('invalid file types', () => {
		it.each([
			['PDF', 'test.pdf', 'application/pdf'],
			['GIF', 'test.gif', 'image/gif'],
			['BMP', 'test.bmp', 'image/bmp'],
			['text', 'test.txt', 'text/plain']
		])('rejects %s files', (_, filename, mimeType) => {
			const file = createMockFile(filename, mimeType);
			const result = validateImageFile(file);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('type');
		});
	});

	describe('file size validation', () => {
		it('rejects files larger than MAX_UPLOAD_SIZE_MB', () => {
			const largeFile = createMockFile('huge.png', 'image/png', 15 * 1024 * 1024);
			const result = validateImageFile(largeFile);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('too large');
			expect(result.error).toContain(`${MAX_UPLOAD_SIZE_MB}MB`);
		});
	});
});

describe('isSvgFile', () => {
	it.each([
		['image/svg+xml', true],
		['image/png', false],
		['image/jpeg', false],
		['image/webp', false]
	])('returns %s for %s type', (mimeType, expected) => {
		const file = createMockFile('test', mimeType);
		expect(isSvgFile(file)).toBe(expected);
	});
});

// =============================================================================
// SVG FUNCTIONS
// =============================================================================

describe('minifySvg', () => {
	it('removes XML comments', () => {
		const input = '<svg><!-- comment --><rect/></svg>';
		const result = minifySvg(input);
		expect(result).not.toContain('<!--');
		expect(result).not.toContain('-->');
		expect(result).toContain('<rect/>');
	});

	it('removes multiple comments', () => {
		const input = '<svg><!-- first --><rect/><!-- second --></svg>';
		const result = minifySvg(input);
		expect(result).not.toContain('first');
		expect(result).not.toContain('second');
	});

	it('removes whitespace between tags', () => {
		const input = '<svg>   <rect/>   <circle/>   </svg>';
		const result = minifySvg(input);
		expect(result).toBe('<svg><rect/><circle/></svg>');
	});

	it('removes DOCTYPE', () => {
		const input = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"><svg></svg>';
		const result = minifySvg(input);
		expect(result).not.toContain('DOCTYPE');
		expect(result).toContain('<svg>');
	});

	it('removes empty attributes', () => {
		const input = '<svg class=""><rect id=""/></svg>';
		const result = minifySvg(input);
		expect(result).not.toContain('class=""');
		expect(result).not.toContain('id=""');
	});

	it('preserves valid SVG structure', () => {
		const input = '<svg viewBox="0 0 100 50"><rect width="10" height="20"/></svg>';
		const result = minifySvg(input);
		expect(result).toContain('viewBox="0 0 100 50"');
		expect(result).toContain('width="10"');
		expect(result).toContain('height="20"');
	});

	it('trims leading and trailing whitespace', () => {
		const input = '   <svg></svg>   ';
		const result = minifySvg(input);
		expect(result).toBe('<svg></svg>');
	});

	it('collapses multiple spaces to one', () => {
		const input = '<svg    viewBox="0   0   100   50"></svg>';
		const result = minifySvg(input);
		expect(result).toContain('viewBox="0 0 100 50"');
	});
});

describe('getSvgAspectRatio', () => {
	it('parses viewBox with spaces', () => {
		const svg = '<svg viewBox="0 0 200 100"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(2); // 200/100 = 2
	});

	it('parses viewBox with commas', () => {
		const svg = '<svg viewBox="0,0,300,100"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(3); // 300/100 = 3
	});

	it('parses viewBox with mixed separators', () => {
		const svg = '<svg viewBox="0 0, 150 100"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(1.5); // 150/100 = 1.5
	});

	it('parses width/height attributes without units', () => {
		const svg = '<svg width="400" height="200"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(2); // 400/200 = 2
	});

	it('parses width/height with px units', () => {
		const svg = '<svg width="100px" height="50px"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(2); // 100/50 = 2
	});

	it('prefers viewBox over width/height', () => {
		// viewBox should take precedence
		const svg = '<svg viewBox="0 0 100 100" width="200" height="50"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(1); // viewBox 100/100 = 1, not width/height
	});

	it('returns 1 for SVG without dimensions', () => {
		const svg = '<svg><rect/></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(1);
	});

	it('returns 1 for invalid SVG (no svg element)', () => {
		const svg = '<div>not an svg</div>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(1);
	});

	it('returns 1 for empty string', () => {
		const result = getSvgAspectRatio('');
		expect(result).toBe(1);
	});

	it('handles SVG with namespace', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 100"></svg>';
		const result = getSvgAspectRatio(svg);
		expect(result).toBe(0.5); // 50/100 = 0.5
	});
});

// =============================================================================
// CANVAS FUNCTIONS
// =============================================================================

describe('findContentBounds', () => {
	describe('with non-white content', () => {
		it('finds bounds for a single black pixel in center', () => {
			// 3x3 image, all white except center pixel (black)
			const pixels = [
				...row(W, W, W), // row 0
				...row(W, B, W), // row 1: center black
				...row(W, W, W) // row 2
			];
			const imageData = createImageData(3, 3, pixels);
			const result = findContentBounds(imageData, 10);

			expect(result).not.toBeNull();
			expect(result!.x).toBe(1);
			expect(result!.y).toBe(1);
			expect(result!.width).toBe(1);
			expect(result!.height).toBe(1);
		});

		it('finds bounds for black rectangle', () => {
			// 5x5 image with 3x2 black rectangle at position (1,1)
			const pixels = [
				...row(W, W, W, W, W), // row 0
				...row(W, B, B, B, W), // row 1
				...row(W, B, B, B, W), // row 2
				...row(W, W, W, W, W), // row 3
				...row(W, W, W, W, W) // row 4
			];
			const imageData = createImageData(5, 5, pixels);
			const result = findContentBounds(imageData, 10);

			expect(result).not.toBeNull();
			expect(result!.x).toBe(1);
			expect(result!.y).toBe(1);
			expect(result!.width).toBe(3);
			expect(result!.height).toBe(2);
		});

		it('finds bounds for content at edges', () => {
			// 3x3 image with content in corners
			const pixels = [
				...row(B, W, B), // row 0: corners black
				...row(W, W, W), // row 1
				...row(B, W, B) // row 2: corners black
			];
			const imageData = createImageData(3, 3, pixels);
			const result = findContentBounds(imageData, 10);

			expect(result).not.toBeNull();
			expect(result!.x).toBe(0);
			expect(result!.y).toBe(0);
			expect(result!.width).toBe(3);
			expect(result!.height).toBe(3);
		});

		it('respects threshold for almost-white pixels', () => {
			// 3x3 image with almost-white pixel in center (250, 250, 250)
			// With threshold 10, pixels with R,G,B > 245 are considered "white"
			const almostWhite = px(250, 250, 250);
			const pixels = [...row(W, W, W), ...row(W, almostWhite, W), ...row(W, W, W)];
			const imageData = createImageData(3, 3, pixels);
			const result = findContentBounds(imageData, 10);

			// 250 is > 255 - 10 = 245, so it's considered white
			expect(result).toBeNull();
		});

		it('detects slightly-off-white as content with strict threshold', () => {
			// 3x3 image with slightly off-white pixel in center (244, 244, 244)
			const offWhite = px(244, 244, 244);
			const pixels = [...row(W, W, W), ...row(W, offWhite, W), ...row(W, W, W)];
			const imageData = createImageData(3, 3, pixels);
			const result = findContentBounds(imageData, 10);

			// 244 is <= 255 - 10 = 245, so it's considered content
			expect(result).not.toBeNull();
			expect(result!.x).toBe(1);
			expect(result!.y).toBe(1);
		});
	});

	describe('with all-white images', () => {
		it('returns null for completely white image', () => {
			const imageData = createSolidImage(10, 10, 255, 255, 255);
			const result = findContentBounds(imageData, 10);
			expect(result).toBeNull();
		});

		it('returns null for almost-white image within threshold', () => {
			// All pixels are (250, 250, 250) - within threshold of 10
			const imageData = createSolidImage(5, 5, 250, 250, 250);
			const result = findContentBounds(imageData, 10);
			expect(result).toBeNull();
		});
	});

	describe('with transparent pixels', () => {
		it('treats fully transparent pixels as white', () => {
			// 3x3 image with transparent pixel in center
			const pixels = [
				...row(W, W, W),
				...row(W, T, W), // transparent black in center
				...row(W, W, W)
			];
			const imageData = createImageData(3, 3, pixels);
			const result = findContentBounds(imageData, 10);

			// Transparent pixels should be ignored
			expect(result).toBeNull();
		});

		it('detects semi-transparent colored pixels', () => {
			// 3x3 image with semi-transparent red pixel in center
			const semiTransparentRed = px(255, 0, 0, 128);
			const pixels = [...row(W, W, W), ...row(W, semiTransparentRed, W), ...row(W, W, W)];
			const imageData = createImageData(3, 3, pixels);
			const result = findContentBounds(imageData, 10);

			// Semi-transparent pixels with color should be detected
			expect(result).not.toBeNull();
			expect(result!.x).toBe(1);
			expect(result!.y).toBe(1);
		});
	});
});

describe('compressWithBinarySearch', () => {
	// Mock canvas and blob APIs
	let mockCanvas: {
		toBlob: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockCanvas = {
			toBlob: vi.fn()
		};

		// Mock FileReader for Node.js environment
		class MockFileReader {
			result: string | null = null;
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;

			readAsDataURL(blob: Blob) {
				// Simulate async behavior
				setTimeout(() => {
					this.result = `data:image/jpeg;base64,${btoa('mock-data-' + blob.size)}`;
					if (this.onload) this.onload();
				}, 0);
			}
		}

		globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * Helper to set up toBlob mock that returns blobs of specified sizes
	 * based on quality parameter
	 */
	function setupToBlobMock(sizeAtQuality: (quality: number) => number) {
		mockCanvas.toBlob.mockImplementation(
			(callback: BlobCallback, type: string, quality: number) => {
				const size = sizeAtQuality(quality);
				const blob = new Blob(['x'.repeat(size)], { type });
				callback(blob);
			}
		);
	}

	it('returns base64 within size limit', async () => {
		// Setup: image compresses to 50KB at quality 0.5
		setupToBlobMock((quality) => {
			// Linear: quality 1.0 = 200KB, quality 0.1 = 20KB
			return Math.round(20000 + quality * 180000);
		});

		const result = await compressWithBinarySearch(
			mockCanvas as unknown as HTMLCanvasElement,
			100 // 100KB limit
		);

		expect(result).toMatch(/^data:image\/jpeg;base64,/);
	});

	it('finds highest quality that fits within limit', async () => {
		const qualitiesUsed: number[] = [];

		mockCanvas.toBlob.mockImplementation(
			(callback: BlobCallback, type: string, quality: number) => {
				qualitiesUsed.push(quality);
				// At quality 0.7, size is exactly 100KB
				// Below 0.7, smaller; above 0.7, larger
				const size = quality <= 0.7 ? 90000 : 120000;
				const blob = new Blob(['x'.repeat(size)], { type });
				callback(blob);
			}
		);

		await compressWithBinarySearch(mockCanvas as unknown as HTMLCanvasElement, 100);

		// Binary search should converge around 0.7
		// The final quality should be close to 0.7 (within precision)
		const lastFittingQuality = qualitiesUsed.filter((q) => q <= 0.7).sort((a, b) => b - a)[0];

		expect(lastFittingQuality).toBeGreaterThanOrEqual(0.65);
	});

	it('throws error when minimum quality still exceeds limit', async () => {
		// Setup: even at minimum quality, image is too large
		setupToBlobMock(() => 200000); // Always 200KB

		await expect(
			compressWithBinarySearch(mockCanvas as unknown as HTMLCanvasElement, 100)
		).rejects.toThrow(/Cannot compress/);
	});

	it('uses binary search with expected number of iterations', async () => {
		setupToBlobMock((quality) => Math.round(50000 + quality * 100000));

		await compressWithBinarySearch(mockCanvas as unknown as HTMLCanvasElement, 100);

		// Binary search with precision 0.05 should take ~4-5 iterations
		// (log2(0.9/0.05) ≈ 4.2)
		const callCount = mockCanvas.toBlob.mock.calls.length;
		expect(callCount).toBeGreaterThanOrEqual(3);
		expect(callCount).toBeLessThanOrEqual(7);
	});

	it('works with very small target size', async () => {
		setupToBlobMock((quality) => Math.round(5000 + quality * 45000)); // 5-50KB range

		const result = await compressWithBinarySearch(
			mockCanvas as unknown as HTMLCanvasElement,
			10 // Only 10KB limit
		);

		expect(result).toMatch(/^data:image\/jpeg;base64,/);
	});
});

// =============================================================================
// PROCESS IMAGE INTEGRATION
// =============================================================================

describe('processImage', () => {
	describe('SVG processing', () => {
		it('processes SVG file and returns base64 with correct aspect ratio', async () => {
			const svgContent = '<svg viewBox="0 0 200 100"><!-- comment --><rect/></svg>';
			const file = new File([svgContent], 'test.svg', { type: 'image/svg+xml' });

			const result = await processImage(file);

			expect(result.originalName).toBe('test.svg');
			expect(result.aspectRatio).toBe(2); // 200/100
			expect(result.data).toMatch(/^data:image\/svg\+xml;base64,/);
			// Verify minification happened (comment removed)
			const decodedContent = atob(result.data.split(',')[1]);
			expect(decodedContent).not.toContain('<!-- comment -->');
		});

		it('throws error for SVG larger than limit', async () => {
			// Create SVG larger than MAX_IMAGE_SIZE_KB
			const largeSvg = '<svg viewBox="0 0 100 100">' + 'x'.repeat(150 * 1024) + '</svg>';
			const file = new File([largeSvg], 'large.svg', { type: 'image/svg+xml' });

			await expect(processImage(file)).rejects.toThrow(/too large/i);
		});

		it('handles SVG without viewBox using width/height', async () => {
			const svgContent = '<svg width="300" height="100"><rect/></svg>';
			const file = new File([svgContent], 'test.svg', { type: 'image/svg+xml' });

			const result = await processImage(file);

			expect(result.aspectRatio).toBe(3); // 300/100
		});

		it('defaults to 1:1 for SVG without dimensions', async () => {
			const svgContent = '<svg><rect/></svg>';
			const file = new File([svgContent], 'test.svg', { type: 'image/svg+xml' });

			const result = await processImage(file);

			expect(result.aspectRatio).toBe(1);
		});

		it('handles SVG with UTF-8 characters', async () => {
			const svgContent = '<svg viewBox="0 0 100 100"><text>Śruba żółta</text></svg>';
			const file = new File([svgContent], 'polish.svg', { type: 'image/svg+xml' });

			const result = await processImage(file);

			expect(result.data).toMatch(/^data:image\/svg\+xml;base64,/);
			// Verify the content can be decoded back
			const base64Content = result.data.split(',')[1];
			expect(() => atob(base64Content)).not.toThrow();
		});
	});

	describe('validation', () => {
		it('rejects invalid file type', async () => {
			const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

			await expect(processImage(file)).rejects.toThrow(/Invalid file type/);
		});

		it('rejects file larger than pre-processing limit', async () => {
			const largeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB
			const file = new File([largeContent], 'huge.png', { type: 'image/png' });

			await expect(processImage(file)).rejects.toThrow(/too large/i);
		});
	});

	// Note: Raster processing tests require browser APIs (Image, Canvas)
	// These should be tested in *.svelte.test.ts files with browser environment
	// or with more comprehensive mocking
});
