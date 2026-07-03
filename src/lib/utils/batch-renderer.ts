/**
 * Batch Tape Renderer
 *
 * Renders multiple labels horizontally on a single canvas with cutting lines
 */

import type { BatchRenderData, BatchLabelConfig, TapeHeight } from '$lib/types/batch';
import { solveLabelLayout } from './label-constraint-solver';
import { renderLabelToCanvas } from './label-renderer';
import { formatPrimaryText, appendOptionalNote } from './label-formatter';
import { getStandardById } from '$lib/data/standards';
import { decimalToFraction } from './fraction-parser';

export interface BatchRenderOptions {
	canvas: HTMLCanvasElement;
	batch: BatchRenderData;
	dpi?: number;
	showMargins?: boolean;
}

interface LabelRenderData {
	config: BatchLabelConfig;
	primaryText: string;
	secondaryText: string;
	standard?: ReturnType<typeof getStandardById>;
	width: number; // Calculated width in mm
}

const MM_TO_INCH = 0.0393701;
const MARGIN_LEFT_MM = 2;
const MARGIN_RIGHT_MM = 2;
const MARGIN_TOP_MM = 1;
const MARGIN_BOTTOM_MM = 1;
const GAP_MM = MARGIN_LEFT_MM + MARGIN_RIGHT_MM; // 4mm gap between labels (2mm + 2mm)
const CUTTING_LINE_COLOR = '#999';
const CUTTING_LINE_DASH_LENGTH_MM = 2; // 2mm dash
const CUTTING_LINE_DASH_GAP_MM = 2; // 2mm gap

/**
 * Converts mm to pixels based on DPI
 */
function mmToPixels(mm: number, dpi: number): number {
	return mm * MM_TO_INCH * dpi;
}

/**
 * Calculates total tape width based on labels and mode
 */
function calculateTotalWidth(labelsData: LabelRenderData[], showMargins: boolean): number {
	if (showMargins) {
		return (
			labelsData.reduce((sum, label) => sum + label.width, 0) + GAP_MM * (labelsData.length - 1)
		);
	}

	const printableWidthsSum = labelsData.reduce((sum, label) => {
		const labelPrintableWidth = label.width - MARGIN_LEFT_MM - MARGIN_RIGHT_MM;
		return sum + labelPrintableWidth;
	}, 0);

	return printableWidthsSum + GAP_MM * (labelsData.length - 1);
}

/**
 * Draws a dashed cutting line at specified x position
 */
function drawCuttingLine(
	ctx: CanvasRenderingContext2D,
	x: number,
	height: number,
	dpi: number
): void {
	const dashLengthPx = mmToPixels(CUTTING_LINE_DASH_LENGTH_MM, dpi);
	const dashGapPx = mmToPixels(CUTTING_LINE_DASH_GAP_MM, dpi);

	ctx.save();
	ctx.strokeStyle = CUTTING_LINE_COLOR;
	ctx.lineWidth = 1;
	ctx.setLineDash([dashLengthPx, dashGapPx]);

	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, height);
	ctx.stroke();

	ctx.restore();
}

/**
 * Calculates hardware image aspect ratio from custom image or standard image
 */
async function getHardwareImageAspectRatio(
	customImage: { aspectRatio: number } | undefined,
	standardImage: string | undefined
): Promise<number | undefined> {
	if (customImage) {
		return customImage.aspectRatio;
	}

	if (!standardImage) return undefined;

	try {
		const img = new Image();
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = reject;
			img.src = standardImage;
		});
		return img.naturalWidth / img.naturalHeight;
	} catch (e) {
		console.warn('Failed to load image for aspect ratio calculation:', e);
		return undefined;
	}
}

export interface BatchLabelRenderOptions {
	/** Destination canvas. Its width/height are set to the printable area at `dpi`. */
	canvas: HTMLCanvasElement;
	config: BatchLabelConfig;
	height: TapeHeight;
	dpi?: number;
}

/**
 * Renders one batch label (printable area only, no margins/cutting lines) onto a
 * caller-supplied canvas via the SAME constraint-solver + canvas pipeline used by
 * the single-mode preview and the batch PNG export. This is the single source of
 * truth for per-label typography, layout, QR and image gating, so the batch list
 * preview and the exported tape stay pixel-identical.
 */
export async function renderBatchLabelToCanvas(options: BatchLabelRenderOptions): Promise<void> {
	const { canvas, config, height, dpi = 300 } = options;
	const { primaryText, secondaryText, standard } = deriveLabelText(config);

	const labelWidthMm = config.width;
	const labelHeightMm = height;
	const printableWidthMm = labelWidthMm - 4;
	const printableHeightMm = labelHeightMm - 2;
	const scale = dpi / 25.4;

	canvas.width = Math.round(printableWidthMm * scale);
	canvas.height = Math.round(printableHeightMm * scale);

	// Determine flags - respect per-label toggle settings (default to true if undefined)
	const showQRCode = (config.showQRCode ?? true) && !!(config.qrCode && height === 12);

	// Get custom image data for general mode
	const generalConfig = config.mode === 'general' ? config : null;
	const customImage = generalConfig?.customImage;
	const showCustomImage = generalConfig?.showCustomImage ?? true;

	// showHardwareImage: fastener mode with standard image OR general mode with custom image (12mm only)
	const showHardwareImage =
		config.mode === 'fastener'
			? (config.showImage ?? true) && !!standard?.image
			: height === 12 && showCustomImage && !!customImage;

	const showStandard =
		config.mode === 'fastener' ? (config.showReference ?? true) && !!standard : false;

	// Calculate hardware image aspect ratio if needed
	const hardwareImageAspectRatio = showHardwareImage
		? await getHardwareImageAspectRatio(customImage, standard?.image)
		: undefined;

	const dimensions = {
		width: labelWidthMm,
		height: labelHeightMm,
		printableWidth: printableWidthMm,
		printableHeight: printableHeightMm
	};

	// Solve layout for this label
	const layout = await solveLabelLayout({
		dimensions,
		showQRCode,
		showHardwareImage,
		showStandard,
		primaryText,
		secondaryText,
		hardwareImageAspectRatio
	});

	// Render label to the destination canvas
	await renderLabelToCanvas({
		canvas,
		dimensions,
		layout,
		content: {
			primaryText,
			secondaryText,
			standard,
			showStandard,
			showHardwareImage,
			showQRCode,
			qrCodeUrl: config.qrCode,
			customImageSrc: customImage?.data
		},
		scale,
		showMargins: false
	});
}

/**
 * Renders a single label onto the main canvas
 */
async function renderSingleLabel(
	ctx: CanvasRenderingContext2D,
	labelData: LabelRenderData,
	batch: BatchRenderData,
	dpi: number,
	showMargins: boolean,
	currentX: number
): Promise<void> {
	const printableWidthMm = labelData.width - 4;
	const printableHeightMm = batch.height - 2;

	// Render this label's printable area via the shared pipeline
	const labelCanvas = document.createElement('canvas');
	await renderBatchLabelToCanvas({
		canvas: labelCanvas,
		config: labelData.config,
		height: batch.height,
		dpi
	});

	// Draw label onto main canvas
	const printableWidthPx = mmToPixels(printableWidthMm, dpi);
	const printableHeightPx = mmToPixels(printableHeightMm, dpi);
	const offsetX = showMargins ? mmToPixels(MARGIN_LEFT_MM, dpi) : 0;
	const offsetY = showMargins ? mmToPixels(MARGIN_TOP_MM, dpi) : 0;

	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(labelCanvas, currentX + offsetX, offsetY, printableWidthPx, printableHeightPx);
	ctx.imageSmoothingEnabled = true;
}

/**
 * Renders a complete batch tape to canvas
 */
export async function renderBatchTape(options: BatchRenderOptions): Promise<void> {
	const { canvas, batch, dpi = 300, showMargins = true } = options;

	if (batch.labels.length === 0) {
		throw new Error('Cannot render empty batch');
	}

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	// Calculate dimensions for all labels
	const labelsData = await Promise.all(
		batch.labels.map((label) => calculateLabelData(label, batch.height))
	);

	// Calculate canvas dimensions
	const tapeHeightMm = batch.height;
	const printableHeightMm = tapeHeightMm - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
	const canvasHeightMm = showMargins ? tapeHeightMm : printableHeightMm;
	const canvasHeightPx = Math.round(mmToPixels(canvasHeightMm, dpi));

	const totalWidthMm = calculateTotalWidth(labelsData, showMargins);
	const totalWidthPx = Math.round(mmToPixels(totalWidthMm, dpi));

	// Set canvas dimensions
	canvas.width = totalWidthPx;
	canvas.height = canvasHeightPx;

	// Clear canvas with white background
	ctx.fillStyle = 'white';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Render each label
	let currentX = 0;
	for (let i = 0; i < labelsData.length; i++) {
		const labelData = labelsData[i];
		const printableWidthMm = labelData.width - 4;

		await renderSingleLabel(ctx, labelData, batch, dpi, showMargins, currentX);

		// Draw cutting line after this label (except for last label)
		if (i < labelsData.length - 1) {
			const labelStepWidth = showMargins ? labelData.width : printableWidthMm;
			const gapPx = mmToPixels(GAP_MM, dpi);
			const labelStepWidthPx = mmToPixels(labelStepWidth, dpi);
			const lineX = currentX + labelStepWidthPx + gapPx / 2;

			drawCuttingLine(ctx, lineX, canvasHeightPx, dpi);
		}

		// Move to next label position
		const labelStepWidth = showMargins ? labelData.width : printableWidthMm;
		currentX += mmToPixels(labelStepWidth + GAP_MM, dpi);
	}
}

/**
 * Gets the standard designation text from a standard object
 */
function getStandardDesignationText(standard: ReturnType<typeof getStandardById>): string {
	if (!standard) return '';

	const primaryDesignation = standard.designations.find((d) => d.system === standard.primarySystem);

	if (primaryDesignation) {
		return `${primaryDesignation.system} ${primaryDesignation.code}`;
	}

	if (standard.designations.length > 0) {
		return `${standard.designations[0].system} ${standard.designations[0].code}`;
	}

	return '';
}

/**
 * Derived, display-ready text for a batch label. Pure and synchronous — shared
 * by the tape renderer (below) and the read-only preview chip so both stay in
 * sync.
 */
export interface DerivedLabelText {
	primaryText: string;
	secondaryText: string;
	standard?: ReturnType<typeof getStandardById>;
}

/**
 * Derives the primary/secondary text (and resolved standard) for a batch label
 * config, matching the single-mode formatting rules.
 */
export function deriveLabelText(config: BatchLabelConfig): DerivedLabelText {
	let primaryText = '';
	let secondaryText = '';
	let standard: ReturnType<typeof getStandardById> | undefined = undefined;

	if (config.mode === 'fastener') {
		// Get standard first to access hardwareType
		if (config.standard) {
			standard = getStandardById(config.standard);
		}

		// Format length: use fractions for imperial, regular toString for metric
		let formattedLength = '';
		if (config.length !== undefined) {
			formattedLength =
				config.measurementSystem === 'imperial'
					? decimalToFraction(config.length)
					: config.length.toString();
		}

		primaryText = formatPrimaryText(
			'fastener',
			config.threadSize,
			formattedLength,
			'',
			config.pitch,
			config.threadType,
			standard?.hardwareType
		);

		// Build secondary text from standard (only if showReference is enabled)
		let baseSecondaryText = '';
		if (standard) {
			// Only include standard designation text if showReference toggle is enabled
			const showReferenceText = config.showReference ?? true;
			if (showReferenceText) {
				baseSecondaryText = getStandardDesignationText(standard);
			}
		}

		// Append optional note to secondary text (matches single mode)
		secondaryText = appendOptionalNote(baseSecondaryText, config.note);
	} else {
		primaryText = config.primaryText;
		// Append optional note to secondary text (matches single mode)
		secondaryText = appendOptionalNote(config.secondaryText ?? '', config.note);
	}

	return { primaryText, secondaryText, standard };
}

/**
 * Calculates render data for a single label
 */
async function calculateLabelData(
	config: BatchLabelConfig,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_tapeHeight: number
): Promise<LabelRenderData> {
	const { primaryText, secondaryText, standard } = deriveLabelText(config);

	return {
		config,
		primaryText,
		secondaryText,
		standard,
		width: config.width
	};
}
