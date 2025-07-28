/**
 * Label Layout Utilities
 *
 * Provides functions for calculating element positions on labels
 */

export interface LabelDimensions {
	width: number;
	height: number;
	printableWidth: number;
	printableHeight: number;
}

export interface TextPositions {
	x: number;
	primaryY: number;
	secondaryY: number;
}

export interface RightElementsLayout {
	size: number;
	x: number;
	y: number;
	hardwareImageX: number;
}

export interface FontSizes {
	primary: number;
	secondary: number;
	note: number;
}

/**
 * Calculate text positions based on label dimensions
 * All positions are relative to printable area origin (0,0)
 * @param dimensions - Label dimensions including printable area
 * @returns Positions for text elements
 */
export function calculateTextPositions(dimensions: LabelDimensions): TextPositions {
	return {
		x: 0, // Start at left edge of printable area
		primaryY: dimensions.printableHeight * 0.35,
		secondaryY: dimensions.printableHeight * 0.65
	};
}

/**
 * Calculate layout for right-side elements (QR code and hardware image)
 * @param dimensions - Label dimensions
 * @param qrCodeSize - Base size for QR code
 * @param showQRCode - Whether QR code is shown
 * @param showHardwareImage - Whether hardware image is shown
 * @returns Layout information for right elements
 */
export function calculateRightElementsLayout(
	dimensions: LabelDimensions,
	qrCodeSize: number,
	showQRCode: boolean,
	showHardwareImage: boolean
): RightElementsLayout {
	const size = 10; // Stały rozmiar 10x10mm

	// All positions relative to printable area origin (0,0)
	const x = dimensions.printableWidth - size; // Right edge of printable area
	const y = (dimensions.printableHeight - size) / 2; // Centered vertically

	// Hardware image shifts left when QR code is also shown
	const hardwareImageX =
		showQRCode && showHardwareImage
			? x - size - 2 // 2mm gap from QR code
			: dimensions.printableWidth - size; // Also at right edge

	return { size, x, y, hardwareImageX };
}

/**
 * Calculate font sizes based on label height
 * @param labelHeight - Height of the label (9 or 12mm)
 * @returns Font sizes for different text elements
 */
export function calculateFontSizes(labelHeight: number): FontSizes {
	return {
		primary: labelHeight === 9 ? 3 : 4,
		secondary: labelHeight === 9 ? 2.5 : 3,
		note: labelHeight === 9 ? 2 : 2.5
	};
}

/**
 * Calculate QR code size based on label height
 * @param labelHeight - Height of the label
 * @returns Appropriate QR code size
 */
export function calculateQRCodeSize(labelHeight: number): number {
	return 10; // Stały rozmiar 10x10mm
}
