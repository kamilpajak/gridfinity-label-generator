/**
 * Layout Coverage Metrics
 *
 * Calculates printable area utilization for label layouts.
 * Provides debugging, analytics, and optimization insights.
 */

import type { SolverOutput, LabelDimensions } from './label-constraint-solver';

export interface CoverageMetadata {
	coveragePercentage: number;
	breakdown: {
		primaryText: number;
		secondaryText: number;
		image: number;
		qrCode: number;
	};
	printableArea: number;
	occupiedArea: number;
	whitespace: number;
}

/**
 * Measures text width using canvas
 */
async function measureText(
	text: string,
	fontFamily: string,
	fontSize: number,
	fontWeight: string
): Promise<number> {
	// Ensure font is loaded
	try {
		await document.fonts.load(`${fontWeight} ${fontSize}px "${fontFamily}"`);
	} catch (e) {
		console.warn('[Metrics] Font loading failed:', e);
	}

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return 0;

	ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
	return ctx.measureText(text).width;
}

/**
 * Calculates coverage metrics for a solved layout
 */
export async function calculateCoverageMetrics(
	layout: SolverOutput,
	dimensions: LabelDimensions,
	content: {
		primaryText: string;
		secondaryText: string;
		showHardwareImage: boolean;
		showQRCode: boolean;
	}
): Promise<CoverageMetadata> {
	const printableArea = dimensions.printableWidth * dimensions.printableHeight;

	let primaryTextArea = 0;
	let secondaryTextArea = 0;

	if (layout.layoutMode === 'ONE_LINE') {
		// ONE LINE MODE: Combined text counted as primary
		const combinedText = content.secondaryText
			? `${content.primaryText} ${content.secondaryText}`
			: content.primaryText;

		if (combinedText) {
			const width = await measureText(combinedText, 'Noto Sans', layout.primaryFontSize, '900');
			const height = layout.primaryFontSize * 1.2;
			primaryTextArea = width * height;
		}
		// secondaryTextArea stays 0 in ONE_LINE mode
	} else {
		// TWO LINE MODE: Measure each text separately
		// Calculate primary text area
		if (content.primaryText) {
			const width = await measureText(
				content.primaryText,
				'Noto Sans',
				layout.primaryFontSize,
				'900'
			);
			const height = layout.primaryFontSize * 1.2;
			primaryTextArea = width * height;
		}

		// Calculate secondary text area
		if (content.secondaryText) {
			const width = await measureText(
				content.secondaryText,
				'Oswald',
				layout.secondaryFontSize,
				'300'
			);
			const height = layout.secondaryFontSize * 1.2;
			secondaryTextArea = width * height;
		}
	}

	// Calculate hardware image area
	let imageArea = 0;
	if (content.showHardwareImage && layout.hardwareImage) {
		imageArea = (layout.hardwareImage.width ?? 0) * (layout.hardwareImage.height ?? 0);
	}

	// Calculate QR code area
	let qrCodeArea = 0;
	if (content.showQRCode && layout.qrCode) {
		qrCodeArea = (layout.qrCode.width ?? 0) * (layout.qrCode.height ?? 0);
	}

	const occupiedArea = primaryTextArea + secondaryTextArea + imageArea + qrCodeArea;
	const coveragePercentage = (occupiedArea / printableArea) * 100;
	const whitespace = printableArea - occupiedArea;

	return {
		coveragePercentage,
		breakdown: {
			primaryText: primaryTextArea,
			secondaryText: secondaryTextArea,
			image: imageArea,
			qrCode: qrCodeArea
		},
		printableArea,
		occupiedArea,
		whitespace
	};
}

/**
 * Enriches solver output with coverage metadata
 */
export async function enrichWithCoverageMetrics(
	layout: SolverOutput,
	dimensions: LabelDimensions,
	content: {
		primaryText: string;
		secondaryText: string;
		showHardwareImage: boolean;
		showQRCode: boolean;
	}
): Promise<SolverOutput & { metadata: CoverageMetadata }> {
	const metadata = await calculateCoverageMetrics(layout, dimensions, content);

	// Debug logging in dev mode
	if (import.meta.env.DEV) {
		console.log('[Coverage Metrics]', {
			coverage: `${metadata.coveragePercentage.toFixed(1)}%`,
			occupied: `${metadata.occupiedArea.toFixed(1)}mm²`,
			whitespace: `${metadata.whitespace.toFixed(1)}mm²`,
			breakdown: {
				primaryText: `${metadata.breakdown.primaryText.toFixed(1)}mm² (${((metadata.breakdown.primaryText / metadata.printableArea) * 100).toFixed(1)}%)`,
				secondaryText: `${metadata.breakdown.secondaryText.toFixed(1)}mm² (${((metadata.breakdown.secondaryText / metadata.printableArea) * 100).toFixed(1)}%)`,
				image: `${metadata.breakdown.image.toFixed(1)}mm² (${((metadata.breakdown.image / metadata.printableArea) * 100).toFixed(1)}%)`,
				qrCode: `${metadata.breakdown.qrCode.toFixed(1)}mm² (${((metadata.breakdown.qrCode / metadata.printableArea) * 100).toFixed(1)}%)`
			}
		});
	}

	return {
		...layout,
		metadata
	};
}
