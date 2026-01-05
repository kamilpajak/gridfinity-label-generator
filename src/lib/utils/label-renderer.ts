/**
 * Label Canvas Renderer
 *
 * Renders labels to canvas for both preview and export
 */

import QRCode from 'qrcode';
import type { SolverOutput } from './label-constraint-solver';
import { shortenUrl, shouldShortenUrl, isValidUrl } from './url-shortener';
import type { ISODINStandard } from '$lib/data/standards';
import { LRUCache } from './lru-cache';

export interface RenderOptions {
	canvas: HTMLCanvasElement;
	dimensions: {
		width: number;
		height: number;
		printableWidth: number;
		printableHeight: number;
	};
	layout: SolverOutput;
	content: {
		primaryText: string;
		secondaryText: string;
		standard?: ISODINStandard;
		showStandard: boolean;
		showHardwareImage: boolean;
		showQRCode: boolean;
		qrCodeUrl?: string;
		/** Custom image source (base64 data URL) for general mode labels */
		customImageSrc?: string;
	};
	scale?: number;
	showMargins?: boolean;
	signal?: AbortSignal;
}

// Cache for loaded images with LRU eviction
const imageCache = new LRUCache<string, HTMLImageElement>(50);

// Cache for QR codes with LRU eviction
const qrCache = new LRUCache<string, string>(50);

/**
 * Throws if the abort signal is aborted
 */
function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new Error('Render aborted');
}

/**
 * Draws the margins guide rectangle
 */
function drawMarginsGuide(
	ctx: CanvasRenderingContext2D,
	dimensions: { printableWidth: number; printableHeight: number },
	scale: number
): void {
	ctx.save();
	ctx.strokeStyle = '#f3f4f6';
	ctx.lineWidth = 0.05 * scale;
	ctx.setLineDash([0.2 * scale, 0.2 * scale]);
	ctx.strokeRect(
		2 * scale,
		1 * scale,
		dimensions.printableWidth * scale,
		dimensions.printableHeight * scale
	);
	ctx.restore();
}

/**
 * Renders a label to canvas
 */
export async function renderLabelToCanvas(options: RenderOptions): Promise<void> {
	const { canvas, dimensions, layout, content, scale = 1, showMargins = true, signal } = options;
	const ctx = canvas.getContext('2d');

	if (!ctx) throw new Error('Failed to get canvas context');

	throwIfAborted(signal);

	// Atomic canvas clearing - reset everything at once
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = 'white';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.restore();

	throwIfAborted(signal);

	if (showMargins) drawMarginsGuide(ctx, dimensions, scale);

	// Save context and set up coordinate system for printable area
	ctx.save();
	if (showMargins) ctx.translate(2 * scale, 1 * scale);

	// Draw text (positioning already determined by layout solver)
	if (content.primaryText) {
		await drawText(ctx, {
			text: content.primaryText,
			x: layout.primaryText.x * scale,
			y: layout.primaryText.y * scale,
			fontFamily: 'Noto Sans',
			fontSize: layout.primaryFontSize * scale,
			fontWeight: '900'
		});
	}

	if (content.secondaryText) {
		await drawText(ctx, {
			text: content.secondaryText,
			x: layout.secondaryText.x * scale,
			y: layout.secondaryText.y * scale,
			fontFamily: 'Oswald',
			fontSize: layout.secondaryFontSize * scale,
			fontWeight: '300'
		});
	}

	// Draw hardware image or custom image
	const imageSrc = content.customImageSrc || content.standard?.image;
	if (content.showHardwareImage && imageSrc && layout.hardwareImage) {
		throwIfAborted(signal);
		try {
			await drawImage(ctx, {
				src: imageSrc,
				x: layout.hardwareImage.x * scale,
				y: layout.hardwareImage.y * scale,
				width: (layout.hardwareImage.width ?? 0) * scale,
				height: (layout.hardwareImage.height ?? 0) * scale
			});
		} catch (error) {
			console.warn('Failed to load image, continuing without it:', error);
		}
	}

	// Draw QR code
	if (content.showQRCode && content.qrCodeUrl && layout.qrCode) {
		throwIfAborted(signal);
		await drawQRCode(
			ctx,
			{
				url: content.qrCodeUrl,
				x: layout.qrCode.x * scale,
				y: layout.qrCode.y * scale,
				size: (layout.qrCode.width ?? 10) * scale
			},
			signal
		);
	}

	ctx.restore();
}

/**
 * Draws text on canvas
 */
async function drawText(
	ctx: CanvasRenderingContext2D,
	options: {
		text: string;
		x: number;
		y: number;
		fontFamily: string;
		fontSize: number;
		fontWeight: string;
	}
): Promise<void> {
	ctx.save();

	// Ensure font is loaded with sample text to trigger unicode-range subsets
	// @fontsource packages use unicode-range subsetting, which requires
	// sample text to determine which subset to load
	try {
		const fontSpec = `${options.fontWeight} ${options.fontSize}px "${options.fontFamily}"`;
		// Load subsets by providing sample text from the actual text to render
		await document.fonts.load(fontSpec, options.text);
	} catch (e) {
		console.warn('Font loading failed:', e);
	}

	ctx.font = `${options.fontWeight} ${options.fontSize}px "${options.fontFamily}"`;
	ctx.fillStyle = 'black';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillText(options.text, options.x, options.y);

	ctx.restore();
}

/**
 * Draws an image on canvas using exact dimensions from constraint solver
 * The constraint solver has already calculated aspect-ratio-aware dimensions
 */
async function drawImage(
	ctx: CanvasRenderingContext2D,
	options: {
		src: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}
): Promise<void> {
	// Check cache first
	let img = imageCache.get(options.src);

	if (!img) {
		img = await loadImage(options.src);
		imageCache.set(options.src, img);
	}

	// Draw image at exact position and size calculated by constraint solver
	// The solver has already handled aspect ratio fitting
	ctx.drawImage(img, options.x, options.y, options.width, options.height);
}

/**
 * Draws QR code on canvas
 */
async function drawQRCode(
	ctx: CanvasRenderingContext2D,
	options: {
		url: string;
		x: number;
		y: number;
		size: number;
	},
	signal?: AbortSignal
): Promise<void> {
	let urlToEncode = options.url;

	// Handle URL shortening if needed
	if (isValidUrl(options.url) && shouldShortenUrl(options.url)) {
		const cacheKey = `short:${options.url}`;
		const cached = qrCache.get(cacheKey);

		if (cached) {
			urlToEncode = cached;
		} else {
			const result = await shortenUrl(options.url);
			if (result.success && result.shortUrl) {
				urlToEncode = result.shortUrl;
				qrCache.set(cacheKey, urlToEncode);
			}
		}
	}

	// Check cache for QR code
	const qrCacheKey = `qr:${urlToEncode}`;
	let qrDataUrl = qrCache.get(qrCacheKey);

	if (!qrDataUrl) {
		// Generate QR code as data URL
		qrDataUrl = await QRCode.toDataURL(urlToEncode, {
			width: Math.round(options.size),
			margin: 0,
			color: {
				dark: '#000000',
				light: '#FFFFFF'
			}
		});
		qrCache.set(qrCacheKey, qrDataUrl);
	}

	// Check if aborted before drawing
	if (signal?.aborted) {
		throw new Error('Render aborted');
	}

	// Draw QR code
	const img = await loadImage(qrDataUrl);

	// Check again after async image load
	if (signal?.aborted) {
		throw new Error('Render aborted');
	}

	ctx.drawImage(img, options.x, options.y, options.size, options.size);
}

/**
 * Loads an image
 */
function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
		img.src = src;
	});
}

/**
 * Clears all caches
 */
export function clearRenderCaches(): void {
	imageCache.clear();
	qrCache.clear();
}
