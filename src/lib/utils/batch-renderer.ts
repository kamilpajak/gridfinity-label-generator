/**
 * Batch Tape Renderer
 *
 * Renders multiple labels horizontally on a single canvas with cutting lines
 */

import type {
	BatchState,
	BatchLabelConfig,
	FastenerLabelConfig,
	GeneralLabelConfig
} from '$lib/types/batch';
import { solveLabelLayout } from './label-constraint-solver';
import { renderLabelToCanvas } from './label-renderer';
import { formatPrimaryText, appendOptionalNote } from './label-formatter';
import { getStandardById } from '$lib/data/standards';
import { decimalToFraction } from './fraction-parser';

export interface BatchRenderOptions {
	canvas: HTMLCanvasElement;
	batch: BatchState;
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

/**
 * Renders a single label onto the main canvas
 */
async function renderSingleLabel(
	ctx: CanvasRenderingContext2D,
	labelData: LabelRenderData,
	batch: BatchState,
	dpi: number,
	showMargins: boolean,
	currentX: number
): Promise<void> {
	const labelWidthMm = labelData.width;
	const labelHeightMm = batch.height;
	const printableWidthMm = labelWidthMm - 4;
	const printableHeightMm = labelHeightMm - 2;
	const scale = dpi / 25.4;

	// Create temporary canvas for this label
	const labelCanvas = document.createElement('canvas');
	labelCanvas.width = Math.round(printableWidthMm * scale);
	labelCanvas.height = Math.round(printableHeightMm * scale);

	// Determine flags - respect per-label toggle settings (default to true if undefined)
	const showQRCode =
		(labelData.config.showQRCode ?? true) && !!(labelData.config.qrCode && batch.height === 12);

	// Get custom image data for general mode
	const generalConfig =
		labelData.config.mode === 'general' ? (labelData.config as GeneralLabelConfig) : null;
	const customImage = generalConfig?.customImage;
	const showCustomImage = generalConfig?.showCustomImage ?? true;

	// showHardwareImage: fastener mode with standard image OR general mode with custom image (12mm only)
	const showHardwareImage =
		labelData.config.mode === 'fastener'
			? (labelData.config.showImage ?? true) && !!labelData.standard?.image
			: batch.height === 12 && showCustomImage && !!customImage;

	const showStandard =
		labelData.config.mode === 'fastener'
			? (labelData.config.showReference ?? true) && !!labelData.standard
			: false;

	// Calculate hardware image aspect ratio if needed
	const hardwareImageAspectRatio = showHardwareImage
		? await getHardwareImageAspectRatio(customImage, labelData.standard?.image)
		: undefined;

	// Solve layout for this label
	const layout = await solveLabelLayout({
		dimensions: {
			width: labelWidthMm,
			height: labelHeightMm,
			printableWidth: printableWidthMm,
			printableHeight: printableHeightMm
		},
		showQRCode,
		showHardwareImage,
		showStandard,
		primaryText: labelData.primaryText,
		secondaryText: labelData.secondaryText,
		hardwareImageAspectRatio
	});

	// Render label to temporary canvas
	await renderLabelToCanvas({
		canvas: labelCanvas,
		dimensions: {
			width: labelWidthMm,
			height: labelHeightMm,
			printableWidth: printableWidthMm,
			printableHeight: printableHeightMm
		},
		layout,
		content: {
			primaryText: labelData.primaryText,
			secondaryText: labelData.secondaryText,
			standard: labelData.standard,
			showStandard,
			showHardwareImage,
			showQRCode,
			qrCodeUrl: labelData.config.qrCode,
			customImageSrc: customImage?.data
		},
		scale,
		showMargins: false
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
 * Calculates render data for a single label
 */
async function calculateLabelData(
	config: BatchLabelConfig,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_tapeHeight: number
): Promise<LabelRenderData> {
	let primaryText = '';
	let secondaryText = '';
	let standard: ReturnType<typeof getStandardById> | undefined = undefined;

	if (config.mode === 'fastener') {
		const fastenerConfig = config as FastenerLabelConfig;

		// Get standard first to access hardwareType
		if (fastenerConfig.standard) {
			standard = getStandardById(fastenerConfig.standard);
		}

		// Format length: use fractions for imperial, regular toString for metric
		let formattedLength = '';
		if (fastenerConfig.length !== undefined) {
			formattedLength =
				fastenerConfig.measurementSystem === 'imperial'
					? decimalToFraction(fastenerConfig.length)
					: fastenerConfig.length.toString();
		}

		primaryText = formatPrimaryText(
			'fastener',
			fastenerConfig.threadSize,
			formattedLength,
			'',
			fastenerConfig.pitch,
			fastenerConfig.threadType,
			standard?.hardwareType
		);

		// Build secondary text from standard (only if showReference is enabled)
		let baseSecondaryText = '';
		if (standard) {
			// Only include standard designation text if showReference toggle is enabled
			const showReferenceText = fastenerConfig.showReference ?? true;
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

	return {
		config,
		primaryText,
		secondaryText,
		standard,
		width: config.width
	};
}
