/**
 * Image Processing Utilities
 *
 * Handles image validation, compression, resizing, and trimming
 * for custom images in general label mode.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum image size after compression (in KB) */
export const MAX_IMAGE_SIZE_KB = 100;

/** Maximum dimension (width or height) for resizing */
export const MAX_DIMENSION = 512;

/** Allowed MIME types for image upload */
export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

/** Tolerance for "almost white" pixels during trim (0-255) */
export const TRIM_THRESHOLD = 10;

/** Minimum quality for binary search compression */
export const COMPRESSION_QUALITY_MIN = 0.1;

/** Precision for binary search compression (5%) */
export const COMPRESSION_QUALITY_PRECISION = 0.05;

/** Maximum file size for upload (in MB) - to prevent processing extremely large files */
export const MAX_UPLOAD_SIZE_MB = 10;

/** Maximum file size before processing (in bytes) */
const MAX_PRE_PROCESSING_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validates an image file for upload
 * Checks MIME type and file size before processing
 */
export function validateImageFile(file: File): ValidationResult {
	// Check file type
	if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
		return {
			valid: false,
			error: `Invalid file type: ${file.type}. Allowed types: PNG, JPG, WebP, SVG`
		};
	}

	// Check file size before processing
	if (file.size > MAX_PRE_PROCESSING_SIZE) {
		return {
			valid: false,
			error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size: ${MAX_UPLOAD_SIZE_MB}MB`
		};
	}

	return { valid: true };
}

/**
 * Checks if a file is an SVG
 */
export function isSvgFile(file: File): boolean {
	return file.type === 'image/svg+xml';
}

// =============================================================================
// SVG FUNCTIONS
// =============================================================================

/**
 * Minifies SVG content by removing comments, whitespace, and empty attributes
 *
 * WARNING: This regex-based minification may damage complex SVGs with
 * embedded CSS, JavaScript, or CDATA. For MVP this is sufficient,
 * but consider using svgo for production.
 */
export function minifySvg(svgContent: string): string {
	return (
		svgContent
			// Remove XML comments
			.replaceAll(/<!--[\s\S]*?-->/g, '')
			// Remove CDATA sections
			.replaceAll(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
			// Remove DOCTYPE
			.replaceAll(/<!DOCTYPE[^>]*>/gi, '')
			// Remove whitespace between tags
			.replaceAll(/>\s+</g, '><')
			// Trim leading and trailing whitespace
			.trim()
			// Remove empty attributes (use single space to avoid ReDoS)
			.replaceAll(/ [a-zA-Z-]+=""/g, '')
			// Collapse multiple spaces to one (inside attribute values too)
			.replaceAll(/\s{2,}/g, ' ')
	);
}

/**
 * Parses viewBox attribute to extract aspect ratio
 * @returns aspect ratio or null if invalid
 */
function parseViewBoxAspectRatio(viewBox: string | null): number | null {
	if (!viewBox) return null;

	const parts = viewBox.split(/[\s,]+/).filter(Boolean);
	if (parts.length < 4) return null;

	const width = Number.parseFloat(parts[2]);
	const height = Number.parseFloat(parts[3]);

	return width > 0 && height > 0 ? width / height : null;
}

/**
 * Parses width/height attributes to extract aspect ratio
 * @returns aspect ratio or null if invalid
 */
function parseDimensionAspectRatio(
	widthAttr: string | null,
	heightAttr: string | null
): number | null {
	if (!widthAttr || !heightAttr) return null;

	const width = Number.parseFloat(widthAttr);
	const height = Number.parseFloat(heightAttr);

	return width > 0 && height > 0 ? width / height : null;
}

/**
 * Parses SVG content to extract aspect ratio
 *
 * Priority:
 * 1. viewBox attribute (most reliable)
 * 2. width/height attributes
 * 3. Default to 1:1
 */
export function getSvgAspectRatio(svgContent: string): number {
	if (!svgContent) return 1;

	// Use DOMParser if available (browser), otherwise fall back to regex
	if (typeof DOMParser === 'undefined') {
		return getSvgAspectRatioFromRegex(svgContent);
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(svgContent, 'image/svg+xml');
	const svgElement = doc.querySelector('svg');

	if (!svgElement) return 1;

	// Priority 1: viewBox, Priority 2: width/height attributes
	return (
		parseViewBoxAspectRatio(svgElement.getAttribute('viewBox')) ??
		parseDimensionAspectRatio(
			svgElement.getAttribute('width'),
			svgElement.getAttribute('height')
		) ??
		1
	);
}

// =============================================================================
// CANVAS FUNCTIONS
// =============================================================================

/**
 * Bounds rectangle for trim operation
 */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Checks if a pixel is content (non-white, non-transparent)
 */
function isContentPixel(data: Uint8ClampedArray, idx: number, whiteThreshold: number): boolean {
	const a = data[idx + 3];
	if (a === 0) return false; // Fully transparent

	const r = data[idx];
	const g = data[idx + 1];
	const b = data[idx + 2];

	// A pixel is white if ALL of R, G, B are above the threshold
	const isWhite = r > whiteThreshold && g > whiteThreshold && b > whiteThreshold;
	return !isWhite;
}

/**
 * Finds the bounding box of non-white content in an image
 *
 * @param imageData - ImageData from canvas.getImageData()
 * @param threshold - Tolerance for "almost white" pixels (0-255)
 * @returns Bounds of content, or null if image is all white/transparent
 */
export function findContentBounds(imageData: ImageData, threshold: number): Bounds | null {
	const { width, height, data } = imageData;
	const whiteThreshold = 255 - threshold;

	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;

			if (isContentPixel(data, idx, whiteThreshold)) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
		}
	}

	if (maxX < 0) return null;

	return {
		x: minX,
		y: minY,
		width: maxX - minX + 1,
		height: maxY - minY + 1
	};
}

/**
 * Converts canvas to blob using specified format and quality
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('Failed to create blob from canvas'));
				}
			},
			type,
			quality
		);
	});
}

/**
 * Converts blob to base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error('Failed to read blob'));
		reader.readAsDataURL(blob);
	});
}

/**
 * Compresses an image using binary search to find optimal quality
 *
 * Finds the highest JPEG quality that results in a file ≤ maxSizeKB.
 *
 * @param canvas - Canvas containing the image to compress
 * @param maxSizeKB - Maximum size in kilobytes
 * @returns Base64 data URL of compressed image
 * @throws Error if compression cannot achieve target size
 */
export async function compressWithBinarySearch(
	canvas: HTMLCanvasElement,
	maxSizeKB: number
): Promise<string> {
	const maxSizeBytes = maxSizeKB * 1024;
	let minQuality = COMPRESSION_QUALITY_MIN;
	let maxQuality = 1;
	let bestResult: string | null = null;

	while (maxQuality - minQuality > COMPRESSION_QUALITY_PRECISION) {
		const midQuality = (minQuality + maxQuality) / 2;
		const blob = await canvasToBlob(canvas, 'image/jpeg', midQuality);

		if (blob.size <= maxSizeBytes) {
			bestResult = await blobToBase64(blob);
			minQuality = midQuality; // Try higher quality
		} else {
			maxQuality = midQuality; // Need lower quality
		}
	}

	// Final attempt at the converged quality
	if (!bestResult) {
		const finalBlob = await canvasToBlob(canvas, 'image/jpeg', minQuality);
		if (finalBlob.size <= maxSizeBytes) {
			bestResult = await blobToBase64(finalBlob);
		}
	}

	if (!bestResult) {
		throw new Error(
			`Cannot compress image to ${maxSizeKB}KB even at minimum quality. ` +
				`Try a simpler image or reduce dimensions.`
		);
	}

	return bestResult;
}

// =============================================================================
// PROCESS IMAGE - MAIN PIPELINE
// =============================================================================

/**
 * Result of processing an image
 */
export interface ProcessedImage {
	/** Base64 data URL of the processed image */
	data: string;
	/** Aspect ratio (width/height) for constraint solver */
	aspectRatio: number;
	/** Original filename for display */
	originalName: string;
}

/**
 * Main function to process an uploaded image
 *
 * Pipeline:
 * - SVG: validate → minify → base64
 * - Raster: validate → trim → resize → compress → base64
 *
 * @param file - File object from input or drag/drop
 * @returns Processed image data ready for storage
 * @throws Error if file is invalid or processing fails
 */
export async function processImage(file: File): Promise<ProcessedImage> {
	// 1. Validate file
	const validation = validateImageFile(file);
	if (!validation.valid) {
		throw new Error(validation.error);
	}

	let resultBase64: string;
	let aspectRatio: number;

	if (isSvgFile(file)) {
		// SVG Pipeline: minify only (no trim/resize for vectors)
		const svgContent = await file.text();
		const minified = minifySvg(svgContent);

		if (minified.length > MAX_IMAGE_SIZE_KB * 1024) {
			const currentKB = Math.round(minified.length / 1024);
			throw new Error(
				`SVG too large after minification (${currentKB}KB > ${MAX_IMAGE_SIZE_KB}KB). ` +
					`Try simplifying the SVG or use a raster format.`
			);
		}

		// Encode to base64 (handle UTF-8 characters)
		resultBase64 = `data:image/svg+xml;base64,${utf8ToBase64(minified)}`;
		aspectRatio = getSvgAspectRatio(svgContent);
	} else {
		// Raster Pipeline: trim → resize → compress
		// This requires browser APIs (Image, Canvas)
		// For now, throw an error - full implementation needs browser environment
		throw new Error(
			'Raster image processing requires browser environment. ' +
				'This should be called from a component, not server-side.'
		);
	}

	return {
		data: resultBase64,
		aspectRatio,
		originalName: file.name
	};
}

/**
 * Encodes a UTF-8 string to base64
 * btoa() only works with ASCII, so we need to encode UTF-8 first
 */
function utf8ToBase64(str: string): string {
	// TextEncoder is available in both browser and Node.js
	if (typeof TextEncoder !== 'undefined') {
		const encoder = new TextEncoder();
		const bytes = encoder.encode(str);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCodePoint(byte);
		}
		return btoa(binary);
	}
	// Fallback for environments without TextEncoder (shouldn't happen in modern browsers)
	// Replace deprecated unescape() with explicit percent-decoding
	return btoa(
		encodeURIComponent(str).replaceAll(/%[\dA-F]{2}/gi, (match) =>
			String.fromCodePoint(Number.parseInt(match.slice(1), 16))
		)
	);
}

/**
 * Fallback regex-based SVG aspect ratio extraction
 */
function getSvgAspectRatioFromRegex(svgContent: string): number {
	// Try viewBox first
	const viewBoxMatch = /viewBox=["']([^"']+)["']/i.exec(svgContent);
	if (viewBoxMatch) {
		const parts = viewBoxMatch[1].split(/[\s,]+/).filter(Boolean);
		if (parts.length >= 4) {
			const width = Number.parseFloat(parts[2]);
			const height = Number.parseFloat(parts[3]);
			if (width > 0 && height > 0) {
				return width / height;
			}
		}
	}

	// Try width/height
	const widthMatch = /\swidth=["']([^"']+)["']/i.exec(svgContent);
	const heightMatch = /\sheight=["']([^"']+)["']/i.exec(svgContent);

	if (widthMatch && heightMatch) {
		const width = Number.parseFloat(widthMatch[1]);
		const height = Number.parseFloat(heightMatch[1]);
		if (width > 0 && height > 0) {
			return width / height;
		}
	}

	return 1;
}

// =============================================================================
// BROWSER-ONLY RASTER FUNCTIONS
// =============================================================================

/**
 * Trims white/transparent borders from a canvas
 *
 * Uses findContentBounds() to detect content area, then creates
 * a new canvas with just the content.
 *
 * @param canvas - Source canvas to trim
 * @returns New canvas with whitespace removed, or original if no content found
 */
export function trimWhitespace(canvas: HTMLCanvasElement): HTMLCanvasElement {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return canvas;
	}

	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const bounds = findContentBounds(imageData, TRIM_THRESHOLD);

	// No content found - return original canvas
	if (!bounds) {
		return canvas;
	}

	// Content fills entire canvas - return original
	if (
		bounds.x === 0 &&
		bounds.y === 0 &&
		bounds.width === canvas.width &&
		bounds.height === canvas.height
	) {
		return canvas;
	}

	// Create new canvas with just the content
	const trimmedCanvas = document.createElement('canvas');
	trimmedCanvas.width = bounds.width;
	trimmedCanvas.height = bounds.height;

	const trimmedCtx = trimmedCanvas.getContext('2d');
	if (!trimmedCtx) {
		return canvas;
	}

	// Copy content area to new canvas
	trimmedCtx.drawImage(
		canvas,
		bounds.x,
		bounds.y,
		bounds.width,
		bounds.height,
		0,
		0,
		bounds.width,
		bounds.height
	);

	return trimmedCanvas;
}

/**
 * Resizes canvas to fit within maximum dimension while maintaining aspect ratio
 *
 * Only scales down - does not upscale small images.
 *
 * @param canvas - Source canvas to resize
 * @param maxDimension - Maximum width or height
 * @returns New canvas with resized image
 */
export function resizeImage(canvas: HTMLCanvasElement, maxDimension: number): HTMLCanvasElement {
	const { width, height } = canvas;

	// No resize needed if already within limits
	if (width <= maxDimension && height <= maxDimension) {
		return canvas;
	}

	// Calculate new dimensions maintaining aspect ratio
	let newWidth: number;
	let newHeight: number;

	if (width > height) {
		// Landscape - constrain by width
		newWidth = maxDimension;
		newHeight = Math.round((height * maxDimension) / width);
	} else {
		// Portrait or square - constrain by height
		newHeight = maxDimension;
		newWidth = Math.round((width * maxDimension) / height);
	}

	// Create new canvas with resized dimensions
	const resizedCanvas = document.createElement('canvas');
	resizedCanvas.width = newWidth;
	resizedCanvas.height = newHeight;

	const ctx = resizedCanvas.getContext('2d');
	if (!ctx) {
		return canvas;
	}

	// Enable smooth scaling
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';

	// Draw scaled image
	ctx.drawImage(canvas, 0, 0, width, height, 0, 0, newWidth, newHeight);

	return resizedCanvas;
}

/**
 * Processes a raster image file in the browser
 *
 * Pipeline: validate → load → trim → resize → compress → base64
 *
 * @param file - Image file from input or drag/drop
 * @returns Processed image data ready for storage
 */
export async function processImageInBrowser(file: File): Promise<ProcessedImage> {
	// 1. Validate file
	const validation = validateImageFile(file);
	if (!validation.valid) {
		throw new Error(validation.error);
	}

	// 2. SVG files should use processImage() instead
	if (isSvgFile(file)) {
		return processImage(file);
	}

	// 3. Load image into canvas
	const canvas = await loadImageToCanvas(file);

	// 4. Trim whitespace
	const trimmedCanvas = trimWhitespace(canvas);

	// 5. Resize if needed
	const resizedCanvas = resizeImage(trimmedCanvas, MAX_DIMENSION);

	// 6. Calculate aspect ratio from final canvas
	const aspectRatio = resizedCanvas.width / resizedCanvas.height;

	// 7. Compress to target size
	const resultBase64 = await compressWithBinarySearch(resizedCanvas, MAX_IMAGE_SIZE_KB);

	return {
		data: resultBase64,
		aspectRatio,
		originalName: file.name
	};
}

/**
 * Loads an image file into a canvas element
 */
async function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			// Fill with white background (for transparent PNGs)
			ctx.fillStyle = 'white';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Draw image
			ctx.drawImage(img, 0, 0);

			resolve(canvas);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}
