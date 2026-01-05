/**
 * Browser-based Image Utils Tests
 *
 * These tests run in a real browser environment (Playwright)
 * and test the raster image processing pipeline.
 */

import { describe, it, expect } from 'vitest';
import {
	trimWhitespace,
	resizeImage,
	processImageInBrowser,
	MAX_IMAGE_SIZE_KB,
	MAX_DIMENSION
} from './image-utils';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a canvas with specified dimensions and optional content
 */
function createTestCanvas(width: number, height: number, fillColor = 'white'): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = fillColor;
	ctx.fillRect(0, 0, width, height);
	return canvas;
}

/**
 * Draws a colored rectangle on canvas (for content testing)
 */
function drawRect(
	canvas: HTMLCanvasElement,
	x: number,
	y: number,
	width: number,
	height: number,
	color: string
): void {
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = color;
	ctx.fillRect(x, y, width, height);
}

/**
 * Creates a test File from canvas data
 */
async function createTestImageFile(
	canvas: HTMLCanvasElement,
	filename: string,
	type: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<File> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(new File([blob], filename, { type }));
				} else {
					reject(new Error('Failed to create blob'));
				}
			},
			type,
			0.9
		);
	});
}

/**
 * Converts base64 data URL to size in KB
 */
function getBase64SizeKB(dataUrl: string): number {
	// Remove data URL prefix
	const base64 = dataUrl.split(',')[1];
	// Base64 size is ~4/3 of binary size
	const binaryLength = (base64.length * 3) / 4;
	return binaryLength / 1024;
}

// =============================================================================
// TRIM WHITESPACE TESTS
// =============================================================================

describe('trimWhitespace (browser)', () => {
	it('trims uniform white border from content', () => {
		// Create 100x100 canvas with white background
		const canvas = createTestCanvas(100, 100, 'white');
		// Draw 50x50 black square centered (25px border on each side)
		drawRect(canvas, 25, 25, 50, 50, 'black');

		const trimmed = trimWhitespace(canvas);

		// Result should be approximately 50x50 (the content size)
		expect(trimmed.width).toBe(50);
		expect(trimmed.height).toBe(50);
	});

	it('trims asymmetric white borders', () => {
		// Create 100x80 canvas with white background
		const canvas = createTestCanvas(100, 80, 'white');
		// Draw 40x30 red rectangle at (10, 20) - different borders on each side
		drawRect(canvas, 10, 20, 40, 30, 'red');

		const trimmed = trimWhitespace(canvas);

		expect(trimmed.width).toBe(40);
		expect(trimmed.height).toBe(30);
	});

	it('preserves content with no white border', () => {
		// Create canvas filled with black (no whitespace)
		const canvas = createTestCanvas(60, 40, 'black');

		const trimmed = trimWhitespace(canvas);

		// Should return same dimensions
		expect(trimmed.width).toBe(60);
		expect(trimmed.height).toBe(40);
	});

	it('handles all-white image (returns original)', () => {
		const canvas = createTestCanvas(100, 100, 'white');

		const trimmed = trimWhitespace(canvas);

		// All-white image should return original (or minimal canvas)
		// Behavior: return original when no content found
		expect(trimmed.width).toBe(100);
		expect(trimmed.height).toBe(100);
	});

	it('respects almost-white threshold', () => {
		// Create canvas with very light gray background (should be trimmed)
		const canvas = createTestCanvas(100, 100, 'rgb(250, 250, 250)');
		// Draw darker gray content
		drawRect(canvas, 20, 20, 60, 60, 'rgb(100, 100, 100)');

		const trimmed = trimWhitespace(canvas);

		// Light gray should be treated as white (within threshold)
		expect(trimmed.width).toBe(60);
		expect(trimmed.height).toBe(60);
	});

	it('handles transparent pixels correctly', () => {
		// Create transparent canvas
		const canvas = createTestCanvas(100, 100, 'transparent');
		// Draw opaque content
		drawRect(canvas, 30, 30, 40, 40, 'blue');

		const trimmed = trimWhitespace(canvas);

		// Should find content bounds ignoring transparent areas
		expect(trimmed.width).toBe(40);
		expect(trimmed.height).toBe(40);
	});
});

// =============================================================================
// RESIZE IMAGE TESTS
// =============================================================================

describe('resizeImage (browser)', () => {
	it('scales down large landscape image', () => {
		const canvas = createTestCanvas(1000, 500, 'gray');
		drawRect(canvas, 100, 100, 200, 200, 'blue'); // Some content

		const resized = resizeImage(canvas, MAX_DIMENSION);

		expect(resized.width).toBe(MAX_DIMENSION);
		expect(resized.height).toBe(256); // 500 * (512/1000) = 256
	});

	it('scales down large portrait image', () => {
		const canvas = createTestCanvas(500, 1000, 'gray');
		drawRect(canvas, 100, 100, 200, 200, 'red');

		const resized = resizeImage(canvas, MAX_DIMENSION);

		expect(resized.width).toBe(256); // 500 * (512/1000) = 256
		expect(resized.height).toBe(MAX_DIMENSION);
	});

	it('scales down large square image', () => {
		const canvas = createTestCanvas(1024, 1024, 'green');

		const resized = resizeImage(canvas, MAX_DIMENSION);

		expect(resized.width).toBe(MAX_DIMENSION);
		expect(resized.height).toBe(MAX_DIMENSION);
	});

	it('does not scale up small images', () => {
		const canvas = createTestCanvas(100, 80, 'purple');

		const resized = resizeImage(canvas, MAX_DIMENSION);

		// Should keep original size (not upscale)
		expect(resized.width).toBe(100);
		expect(resized.height).toBe(80);
	});

	it('does not scale image at exactly MAX_DIMENSION', () => {
		const canvas = createTestCanvas(MAX_DIMENSION, MAX_DIMENSION, 'orange');

		const resized = resizeImage(canvas, MAX_DIMENSION);

		expect(resized.width).toBe(MAX_DIMENSION);
		expect(resized.height).toBe(MAX_DIMENSION);
	});

	it('maintains aspect ratio with odd dimensions', () => {
		const canvas = createTestCanvas(1001, 501, 'cyan');

		const resized = resizeImage(canvas, MAX_DIMENSION);

		const originalRatio = 1001 / 501;
		const resizedRatio = resized.width / resized.height;

		// Aspect ratio should be preserved (within rounding error)
		expect(Math.abs(originalRatio - resizedRatio)).toBeLessThan(0.01);
	});
});

// =============================================================================
// PROCESS IMAGE IN BROWSER TESTS
// =============================================================================

describe('processImageInBrowser', () => {
	it('processes PNG file with white borders', async () => {
		// Create test image with white borders
		const canvas = createTestCanvas(200, 200, 'white');
		drawRect(canvas, 50, 50, 100, 100, 'navy');
		const file = await createTestImageFile(canvas, 'test.png', 'image/png');

		const result = await processImageInBrowser(file);

		expect(result.data).toMatch(/^data:image\/jpeg;base64,/);
		expect(result.aspectRatio).toBeCloseTo(1, 1); // 100x100 content = 1:1
		expect(result.originalName).toBe('test.png');
	});

	it('processes JPEG file', async () => {
		const canvas = createTestCanvas(300, 200, 'darkgreen');
		const file = await createTestImageFile(canvas, 'photo.jpg', 'image/jpeg');

		const result = await processImageInBrowser(file);

		expect(result.data).toMatch(/^data:image\/jpeg;base64,/);
		expect(result.aspectRatio).toBeCloseTo(1.5, 1); // 300/200 = 1.5
		expect(result.originalName).toBe('photo.jpg');
	});

	it('returns correct aspect ratio for landscape image', async () => {
		const canvas = createTestCanvas(400, 200, 'maroon');
		const file = await createTestImageFile(canvas, 'landscape.png');

		const result = await processImageInBrowser(file);

		expect(result.aspectRatio).toBeCloseTo(2, 1); // 400/200 = 2
	});

	it('returns correct aspect ratio for portrait image', async () => {
		const canvas = createTestCanvas(200, 400, 'teal');
		const file = await createTestImageFile(canvas, 'portrait.png');

		const result = await processImageInBrowser(file);

		expect(result.aspectRatio).toBeCloseTo(0.5, 1); // 200/400 = 0.5
	});

	it('compresses large image to under MAX_IMAGE_SIZE_KB', async () => {
		// Create a large, complex image that needs compression
		const canvas = createTestCanvas(1000, 1000, 'white');
		// Add noise/detail to increase file size
		const ctx = canvas.getContext('2d')!;
		for (let i = 0; i < 1000; i++) {
			ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`; // NOSONAR - test data only
			ctx.fillRect(
				Math.random() * 1000, // NOSONAR
				Math.random() * 1000, // NOSONAR
				Math.random() * 50 + 10, // NOSONAR
				Math.random() * 50 + 10 // NOSONAR
			);
		}
		const file = await createTestImageFile(canvas, 'complex.png');

		const result = await processImageInBrowser(file);

		const sizeKB = getBase64SizeKB(result.data);
		expect(sizeKB).toBeLessThanOrEqual(MAX_IMAGE_SIZE_KB);
	});

	it('preserves small simple image without heavy compression', async () => {
		// Simple, small image that shouldn't need much compression
		const canvas = createTestCanvas(100, 100, 'blue');
		const file = await createTestImageFile(canvas, 'simple.png');

		const result = await processImageInBrowser(file);

		// Should still be valid
		expect(result.data).toMatch(/^data:image\/jpeg;base64,/);
		expect(result.aspectRatio).toBe(1);
	});

	it('throws error for invalid file type', async () => {
		// Create a fake text file
		const file = new File(['not an image'], 'test.txt', { type: 'text/plain' });

		await expect(processImageInBrowser(file)).rejects.toThrow(/Invalid file type/);
	});

	it('includes original filename in result', async () => {
		const canvas = createTestCanvas(50, 50, 'yellow');
		const file = await createTestImageFile(canvas, 'my-custom-image.png');

		const result = await processImageInBrowser(file);

		expect(result.originalName).toBe('my-custom-image.png');
	});
});
