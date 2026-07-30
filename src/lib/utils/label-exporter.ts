/**
 * Label PNG Export Utility for Canvas
 *
 * Exports canvas-based labels to high-quality PNG files for printing.
 */

import { renderLabelToCanvas, resolveImageWithSvgPriority } from './label-renderer';
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
	/** Custom image source (base64 data URL) for general mode labels */
	customImageSrc?: string;
	/** Aspect ratio of custom image (width/height) */
	customImageAspectRatio?: number;
}

const DEFAULT_DPI = 360;
const DEFAULT_MARGINS = { left: 2, right: 2, top: 1, bottom: 1 };

export interface RenderedExportCanvas {
	canvas: HTMLCanvasElement;
	/** Printable width in mm (label width minus horizontal margins). */
	printableWidth: number;
	/** Printable height in mm (label height minus vertical margins). */
	printableHeight: number;
}

/**
 * Renders a label to a high-resolution export canvas, cropped to the printable
 * area. Shared by the PNG exporter and the `.lbx` (image-wrapped) exporter.
 */
export async function renderLabelToExportCanvas(
	options: CanvasExportOptions
): Promise<RenderedExportCanvas> {
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
		customImageSrc,
		customImageAspectRatio
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

	// Calculate image aspect ratio if needed
	// For general mode: use custom image aspect ratio
	// For fastener mode: load hardware image aspect ratio dynamically
	let hardwareImageAspectRatio: number | undefined;
	const isGeneralItemMode = labelMode === 'general';

	if (isGeneralItemMode && showHardwareImage && customImageSrc && customImageAspectRatio) {
		// General mode with custom image - use provided aspect ratio
		hardwareImageAspectRatio = customImageAspectRatio;
	} else if (!isGeneralItemMode && showHardwareImage && standard?.image) {
		// Fastener mode with standard image - load with SVG priority
		const resolved = await resolveImageWithSvgPriority(standard.image!);
		if (resolved.image) {
			hardwareImageAspectRatio = resolved.image.naturalWidth / resolved.image.naturalHeight;
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
				qrCodeUrl,
				customImageSrc
			},
			scale,
			showMargins: false // No margins in export
		});
		console.log('Canvas rendered successfully');
	} catch (error) {
		console.error('Failed to render canvas:', error);
		throw error;
	}

	return { canvas: exportCanvas, printableWidth, printableHeight };
}

/**
 * Exports a label to PNG format using canvas, cropping to printable area.
 */
export async function exportCanvasLabelAsPNG(options: CanvasExportOptions): Promise<void> {
	const { canvas, printableWidth, printableHeight } = await renderLabelToExportCanvas(options);

	const filename = generateLabelFilename({
		labelMode: options.labelMode,
		standard: options.standard,
		threadSize: options.threadSize,
		length: options.length,
		primaryText: options.primaryText,
		secondaryText: options.secondaryText,
		printableWidth,
		printableHeight
	});

	await downloadCanvasAsPng(canvas, filename);
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
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				console.log('Download link clicked and cleaned up');
				resolve();
			});
		}, 'image/png');
	});
}
