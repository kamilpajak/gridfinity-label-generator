/**
 * Label PNG Export Utility for Canvas
 *
 * Exports canvas-based labels to high-quality PNG files for printing.
 */

import { renderLabelToCanvas } from './label-renderer';
import { solveLabelLayout } from './label-constraint-solver';
import { enrichWithCoverageMetrics } from './layout-metrics';
import { generateLabelFilename } from './filename-generator';
import type { ISODINStandard } from '$lib/data/standards';

export interface CanvasExportOptions {
	labelWidth: number;
	labelHeight: number;
	primaryText: string;
	secondaryText: string;
	standard?: ISODINStandard;
	showStandard: boolean;
	showHardwareImage: boolean;
	showQRCode: boolean;
	qrCodeUrl?: string;
	dpi?: number;
	margins?: {
		left: number;
		right: number;
		top: number;
		bottom: number;
	};
	// New fields for filename generation
	labelMode: 'fastener' | 'general';
	threadSize?: string;
	length?: string;
}

const DEFAULT_DPI = 360;
const DEFAULT_MARGINS = { left: 2, right: 2, top: 1, bottom: 1 };

/**
 * Exports a label to PNG format using canvas, cropping to printable area
 */
export async function exportCanvasLabelAsPNG(options: CanvasExportOptions): Promise<void> {
	console.log('exportCanvasLabelAsPNG called with options:', options);

	const {
		labelWidth,
		labelHeight,
		primaryText,
		secondaryText,
		standard,
		showStandard,
		showHardwareImage,
		showQRCode,
		qrCodeUrl,
		dpi = DEFAULT_DPI,
		margins = DEFAULT_MARGINS,
		labelMode,
		threadSize,
		length
	} = options;

	// Calculate printable area dimensions (without margins)
	const printableWidth = labelWidth - margins.left - margins.right;
	const printableHeight = labelHeight - margins.top - margins.bottom;

	// Calculate scale based on DPI (DPI / 25.4 mm per inch)
	const scale = dpi / 25.4;

	// Create high-res canvas for export
	const exportCanvas = document.createElement('canvas');
	exportCanvas.width = Math.round(printableWidth * scale);
	exportCanvas.height = Math.round(printableHeight * scale);

	// Calculate dimensions
	const dimensions = {
		width: labelWidth,
		height: labelHeight,
		printableWidth,
		printableHeight
	};

	// Calculate hardware image aspect ratio if needed
	let hardwareImageAspectRatio: number | undefined;
	if (showHardwareImage && standard?.image) {
		try {
			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = reject;
				img.src = standard.image!;
			});
			hardwareImageAspectRatio = img.naturalWidth / img.naturalHeight;
		} catch (e) {
			console.warn('Failed to load image for aspect ratio calculation:', e);
		}
	}

	// Solve layout
	const baseLayout = await solveLabelLayout({
		dimensions,
		showQRCode,
		showHardwareImage,
		showStandard,
		primaryText,
		secondaryText,
		hardwareImageAspectRatio
	});

	// Enrich with coverage metrics
	const layout = await enrichWithCoverageMetrics(baseLayout, dimensions, {
		primaryText,
		secondaryText,
		showHardwareImage,
		showQRCode
	});

	console.log('About to render to canvas');
	// Render to export canvas at high resolution
	try {
		await renderLabelToCanvas({
			canvas: exportCanvas,
			dimensions,
			layout,
			content: {
				primaryText,
				secondaryText,
				standard,
				showStandard,
				showHardwareImage,
				showQRCode,
				qrCodeUrl
			},
			scale,
			showMargins: false // No margins in export
		});
		console.log('Canvas rendered successfully');
	} catch (error) {
		console.error('Failed to render canvas:', error);
		throw error;
	}

	// Generate descriptive filename
	const filename = generateLabelFilename({
		labelMode,
		standard,
		threadSize,
		length,
		primaryText,
		secondaryText,
		printableWidth,
		printableHeight
	});

	// Download the canvas
	console.log('About to download canvas with filename:', filename);
	await downloadCanvasAsPng(exportCanvas, filename);
	console.log('Download initiated');
}

/**
 * Downloads canvas content as PNG file
 */
function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
	console.log('downloadCanvasAsPng called, canvas dimensions:', canvas.width, 'x', canvas.height);

	// Check if we're in a browser environment
	if (typeof document === 'undefined' || !document.body) {
		console.error('Download not available - not in browser environment');
		return Promise.reject(new Error('Download not available in this environment'));
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			console.log('Blob created:', blob);
			if (!blob) {
				console.error('Failed to create PNG blob');
				reject(new Error('Failed to create PNG blob'));
				return;
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.style.display = 'none';
			document.body.appendChild(a); // Add to DOM before clicking
			console.log('About to click download link');

			// Use requestAnimationFrame to ensure the link is in the DOM and browser is ready
			requestAnimationFrame(() => {
				a.click();
				document.body.removeChild(a); // Remove from DOM after clicking
				URL.revokeObjectURL(url);
				console.log('Download link clicked and cleaned up');
				resolve();
			});
		}, 'image/png');
	});
}
