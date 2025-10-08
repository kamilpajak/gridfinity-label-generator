/**
 * Label Constraint Solver using Kiwi.js
 *
 * This module uses constraint solving to dynamically calculate optimal positions
 * for label elements based on configuration and available space.
 * All calculations are relative to the printable area (0,0 origin).
 */

import { Solver, Variable, Constraint, Expression, Operator, Strength } from '@lume/kiwi';
import { measureText, calculateOptimalFontSize } from './text-measurer';
import { getCachedFontMetrics, getCachedCapHeight } from './font-metrics';
import { PRIMARY_FONT, SECONDARY_FONT } from '$lib/constants/fonts';

export interface LabelDimensions {
	width: number; // Physical label width
	height: number; // Physical label height
	printableWidth: number; // Usable width after margins
	printableHeight: number; // Usable height after margins
}

export interface SolverInput {
	dimensions: LabelDimensions;
	showQRCode: boolean;
	showHardwareImage: boolean;
	showStandard: boolean;
	primaryText: string; // Actual text content for width calculation
	secondaryText: string; // Actual text content for width calculation
	hardwareImageAspectRatio?: number; // width/height ratio of the hardware image
}

export interface ElementPosition {
	x: number;
	y: number;
	width?: number;
	height?: number;
}

export type LayoutMode = 'ONE_LINE' | 'TWO_LINE' | 'IMAGE_HORIZONTAL';

export interface SolverOutput {
	primaryText: ElementPosition;
	secondaryText: ElementPosition;
	primaryFontSize: number; // Optimized font size for primary text
	secondaryFontSize: number; // Optimized font size for secondary text
	qrCode?: ElementPosition;
	hardwareImage?: ElementPosition;
	textClipWidth: number; // Width available for text before right elements
	layoutMode?: LayoutMode; // Whether texts are on one line or two
	metadata?: {
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
	};
}

const QR_SIZE = 10; // Fixed size for QR code (10x10mm)
const MIN_SPACING = 1; // Minimum spacing between elements (1mm)
// Force HMR update
const MIN_IMAGE_SIZE = 6; // Minimum hardware image size (6mm)
const MIN_TEXT_WIDTH = 15; // Minimum width reserved for text (15mm)

/**
 * Scores a layout solution for optimality
 * Higher score = better layout
 */
function scoreLayout(
	primaryFontSize: number,
	secondaryFontSize: number,
	primaryWidth: number,
	secondaryWidth: number,
	availableWidth: number,
	dimensions: LabelDimensions
): number {
	let score = 0;

	// PRIMARY CRITERION: Font size (readability)
	// Larger fonts = better readability
	// Weight: 100 (most important)
	const avgFontSize = (primaryFontSize + secondaryFontSize) / 2;
	score += avgFontSize * 100;

	// SECONDARY CRITERION: Text fit
	// Penalize if text is very close to width limit (feels cramped)
	// Weight: 50
	const maxTextWidth = Math.max(primaryWidth, secondaryWidth);
	const widthUtilization = maxTextWidth / availableWidth;
	if (widthUtilization < 0.9) {
		// Good fit - text has breathing room
		score += 50 * (1 - widthUtilization);
	} else {
		// Too tight - penalize
		score -= 50 * (widthUtilization - 0.9);
	}

	// TERTIARY CRITERION: Height utilization
	// Using more vertical space is good (better coverage)
	// Weight: 20
	const primaryHeight = primaryFontSize;
	const secondaryHeight = secondaryFontSize;
	const totalHeight = primaryHeight + secondaryHeight;
	const heightUtilization = totalHeight / dimensions.printableHeight;
	score += heightUtilization * 20;

	return score;
}

export async function solveLabelLayout(input: SolverInput): Promise<SolverOutput> {
	const { dimensions, primaryText, secondaryText } = input;
	const hasSecondaryText = !!secondaryText;

	// Note: Font metrics are cached for performance
	// In production, metrics are loaded once and reused

	// Load font metrics once at the start (cached for performance)
	const [primaryMetrics, secondaryMetrics] = await Promise.all([
		getCachedFontMetrics('Noto Sans', '900'),
		getCachedFontMetrics('Oswald', '300')
	]);

	const fontMetricsData = {
		primary: primaryMetrics,
		secondary: secondaryMetrics
	};

	// If no secondary text, always use TWO_LINE mode (only one line anyway)
	if (!hasSecondaryText) {
		const result = await solveLayoutInMode(input, 'TWO_LINE', fontMetricsData);
		return { ...result, layoutMode: 'TWO_LINE' };
	}

	// Check if IMAGE_HORIZONTAL mode should be used
	// Conditions:
	// 1. Hardware image is enabled
	// 2. Image has high aspect ratio (wide/long image) > 3.4
	// 3. Label is wide enough for horizontal layout (aspect ratio ≥ 2.9)
	const shouldUseImageHorizontal =
		input.showHardwareImage &&
		input.hardwareImageAspectRatio &&
		input.hardwareImageAspectRatio > 3.4 &&
		dimensions.width / dimensions.height >= 2.9;

	if (shouldUseImageHorizontal) {
		const result = await solveLayoutInMode(input, 'IMAGE_HORIZONTAL', fontMetricsData);
		return { ...result, layoutMode: 'IMAGE_HORIZONTAL' };
	}

	// Try both modes and pick the best
	const oneLineResult = await solveLayoutInMode(input, 'ONE_LINE', fontMetricsData);
	const twoLineResult = await solveLayoutInMode(input, 'TWO_LINE', fontMetricsData);

	// Score both solutions
	const oneLineScore = scoreLayout(
		oneLineResult.primaryFontSize,
		oneLineResult.secondaryFontSize,
		await measureText(
			`${primaryText} ${secondaryText}`,
			'Noto Sans',
			oneLineResult.primaryFontSize,
			'900'
		),
		0, // No secondary text in ONE_LINE mode
		oneLineResult.textClipWidth,
		dimensions
	);

	const twoLineScore = scoreLayout(
		twoLineResult.primaryFontSize,
		twoLineResult.secondaryFontSize,
		await measureText(primaryText, 'Noto Sans', twoLineResult.primaryFontSize, '900'),
		await measureText(secondaryText, 'Oswald', twoLineResult.secondaryFontSize, '300'),
		twoLineResult.textClipWidth,
		dimensions
	);

	// Debug logging in dev mode
	// DEBUG: Uncomment to log layout mode decisions
	// if (import.meta.env.DEV) {
	// 	console.log('[Layout Decision]', {
	// 		oneLineScore: oneLineScore.toFixed(1),
	// 		twoLineScore: twoLineScore.toFixed(1),
	// 		winner: oneLineScore > twoLineScore ? 'ONE_LINE' : 'TWO_LINE',
	// 		oneLineFonts: `${oneLineResult.primaryFontSize.toFixed(1)}mm`,
	// 		twoLineFonts: `${twoLineResult.primaryFontSize.toFixed(1)}mm / ${twoLineResult.secondaryFontSize.toFixed(1)}mm`
	// 	});
	// }

	// Return the better solution
	if (oneLineScore > twoLineScore) {
		return { ...oneLineResult, layoutMode: 'ONE_LINE' };
	} else {
		return { ...twoLineResult, layoutMode: 'TWO_LINE' };
	}
}

/**
 * Calculates optimal font sizes for both texts when they share a line
 * Used by ONE_LINE and IMAGE_HORIZONTAL modes
 */
async function calculateSharedLineFontSizes(
	primaryText: string,
	secondaryText: string,
	availableWidth: number,
	hasSecondaryText: boolean,
	fontBounds: {
		primary: { min: number; max: number };
		secondary: { min: number; max: number };
	}
): Promise<{ primaryFontSize: number; secondaryFontSize: number }> {
	// Measure widths to determine how to balance font sizes
	const primaryWidth = await measureText(primaryText, 'Noto Sans', fontBounds.primary.max, '900');
	const secondaryWidth = await measureText(
		secondaryText,
		'Oswald',
		fontBounds.secondary.max,
		'300'
	);

	// Allocate width proportionally
	const totalWidth = primaryWidth + secondaryWidth + MIN_SPACING;
	const primaryRatio = primaryWidth / totalWidth;
	const secondaryRatio = secondaryWidth / totalWidth;

	const primaryFontSize = await calculateOptimalFontSize(
		primaryText,
		'Noto Sans',
		'900',
		availableWidth * primaryRatio,
		fontBounds.primary.min,
		fontBounds.primary.max
	);

	const secondaryFontSize = hasSecondaryText
		? await calculateOptimalFontSize(
				secondaryText,
				'Oswald',
				'300',
				availableWidth * secondaryRatio,
				fontBounds.secondary.min,
				fontBounds.secondary.max
			)
		: fontBounds.secondary.max;

	return { primaryFontSize, secondaryFontSize };
}

/**
 * Optimizes font sizes to fit vertically in ONE_LINE mode
 */
function optimizeOneLineVertically(
	primaryFontSize: number,
	secondaryFontSize: number,
	dimensions: LabelDimensions
): { primaryFontSize: number; secondaryFontSize: number } {
	let primary = primaryFontSize;
	let secondary = secondaryFontSize;
	let iterations = 0;
	const maxIterations = 20;

	while (iterations < maxIterations) {
		const maxTextHeight = Math.max(primary, secondary);

		if (maxTextHeight <= dimensions.printableHeight) {
			break;
		}

		// Scale down both fonts proportionally to fit
		const scale = dimensions.printableHeight / maxTextHeight;
		primary = Math.max(primary * scale, 0.5);
		secondary = Math.max(secondary * scale, 0.5);

		iterations++;
	}

	return { primaryFontSize: primary, secondaryFontSize: secondary };
}

/**
 * Calculates split-half layout font sizes
 * Divides printable area in half with fixed 0.5mm spacing
 * Scales content to fill each zone INDEPENDENTLY
 * Used by both IMAGE_HORIZONTAL and TWO_LINE modes
 */
async function calculateSplitHalfFontSizes(
	dimensions: LabelDimensions,
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	},
	primaryText: string,
	secondaryText: string,
	availableWidth: number,
	fontBounds: {
		primary: { min: number; max: number };
		secondary: { min: number; max: number };
	},
	mode: 'IMAGE_HORIZONTAL' | 'TWO_LINE'
): Promise<{ primaryFontSize: number; secondaryFontSize: number }> {
	const FIXED_SPACING = 0.5;
	const zoneHeight = (dimensions.printableHeight - FIXED_SPACING) / 2;

	// Step 1: Calculate maximum font sizes to fill zone heights
	// Both fonts will have the SAME visual height
	let primaryFontSize =
		zoneHeight / (fontMetricsData.primary.ascent + fontMetricsData.primary.descent);
	let secondaryFontSize =
		zoneHeight / (fontMetricsData.secondary.ascent + fontMetricsData.secondary.descent);

	// Step 2: Check width constraints based on mode
	const primaryWidth = await measureText(primaryText, 'Noto Sans', primaryFontSize, '900');
	const secondaryWidth = await measureText(secondaryText, 'Oswald', secondaryFontSize, '300');

	let scaleFactor = 1.0;

	if (mode === 'IMAGE_HORIZONTAL') {
		// IMAGE_HORIZONTAL: Both texts on same line - check combined width
		const combinedWidth = primaryWidth + MIN_SPACING + secondaryWidth;
		if (combinedWidth > availableWidth) {
			scaleFactor = availableWidth / combinedWidth;
		}
	} else {
		// TWO_LINE: Texts on separate lines - check each independently
		if (primaryWidth > availableWidth) {
			const primaryScale = availableWidth / primaryWidth;
			scaleFactor = Math.min(scaleFactor, primaryScale);
		}

		if (secondaryWidth > availableWidth) {
			const secondaryScale = availableWidth / secondaryWidth;
			scaleFactor = Math.min(scaleFactor, secondaryScale);
		}
	}

	// Step 3: Apply uniform scale to both fonts
	// This maintains the same visual height for both fonts
	primaryFontSize *= scaleFactor;
	secondaryFontSize *= scaleFactor;

	return { primaryFontSize, secondaryFontSize };
}

/**
 * Calculates split-half layout font sizes for IMAGE_HORIZONTAL mode
 * Image sizing is handled by calculateOptimalImageSize
 */
async function calculateImageHorizontalSplitHalfSizes(
	dimensions: LabelDimensions,
	imageAspectRatio: number,
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	},
	primaryText: string,
	secondaryText: string,
	availableWidth: number,
	fontBounds: {
		primary: { min: number; max: number };
		secondary: { min: number; max: number };
	}
): Promise<{ primaryFontSize: number; secondaryFontSize: number }> {
	// Calculate font sizes using shared split-half logic with independent optimization
	return await calculateSplitHalfFontSizes(
		dimensions,
		fontMetricsData,
		primaryText,
		secondaryText,
		availableWidth,
		fontBounds,
		'IMAGE_HORIZONTAL'
	);
}

/**
 * Validates and adjusts font sizes to fit horizontally
 * For ONE_LINE mode: scales both fonts together (they share a line)
 * For TWO_LINE and IMAGE_HORIZONTAL: fonts already independently optimized, skip validation
 */
async function validateHorizontalFit(
	mode: LayoutMode,
	primaryText: string,
	secondaryText: string,
	primaryFontSize: number,
	secondaryFontSize: number,
	hasSecondaryText: boolean,
	availableWidth: number
): Promise<{ primaryFontSize: number; secondaryFontSize: number }> {
	if (mode === 'ONE_LINE') {
		// ONE_LINE: Check both texts side by side with spacing
		const primaryWidth = await measureText(primaryText, 'Noto Sans', primaryFontSize, '900');
		const secondaryWidth = hasSecondaryText
			? await measureText(secondaryText, 'Oswald', secondaryFontSize, '300')
			: 0;
		const combinedWidth = primaryWidth + (hasSecondaryText ? MIN_SPACING + secondaryWidth : 0);

		if (combinedWidth > availableWidth) {
			const horizontalScale = availableWidth / combinedWidth;
			return {
				primaryFontSize: Math.max(primaryFontSize * horizontalScale, 0.5),
				secondaryFontSize: Math.max(secondaryFontSize * horizontalScale, 0.5)
			};
		}
	}
	// For TWO_LINE and IMAGE_HORIZONTAL modes:
	// Fonts are already independently optimized by calculateSplitHalfFontSizes
	// No additional validation needed - each font was calculated to fit its zone

	return { primaryFontSize, secondaryFontSize };
}

/**
 * Calculates initial font sizes based on layout mode
 */
async function calculateInitialFontSizes(
	mode: LayoutMode,
	primaryText: string,
	secondaryText: string,
	availableWidth: number,
	hasSecondaryText: boolean,
	fontBounds: {
		primary: { min: number; max: number };
		secondary: { min: number; max: number };
	}
): Promise<{ primaryFontSize: number; secondaryFontSize: number }> {
	// Shared line modes: ONE_LINE and IMAGE_HORIZONTAL
	if (mode === 'ONE_LINE' || mode === 'IMAGE_HORIZONTAL') {
		return calculateSharedLineFontSizes(
			primaryText,
			secondaryText,
			availableWidth,
			hasSecondaryText,
			fontBounds
		);
	}

	// TWO_LINE mode: Calculate each text independently
	const primaryFontSize = await calculateOptimalFontSize(
		primaryText,
		'Noto Sans',
		'900',
		availableWidth,
		fontBounds.primary.min,
		fontBounds.primary.max
	);

	const secondaryFontSize = hasSecondaryText
		? await calculateOptimalFontSize(
				secondaryText,
				'Oswald',
				'300',
				availableWidth,
				fontBounds.secondary.min,
				fontBounds.secondary.max
			)
		: fontBounds.secondary.max;

	return { primaryFontSize, secondaryFontSize };
}

/**
 * Solves layout in a specific mode (ONE_LINE or TWO_LINE)
 */
async function solveLayoutInMode(
	input: SolverInput,
	mode: LayoutMode,
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	}
): Promise<SolverOutput> {
	const { dimensions, primaryText, secondaryText } = input;
	const hasSecondaryText = !!secondaryText;

	// Define consistent font size bounds for all label sizes
	const fontBounds = {
		primary: { min: 0.5, max: 6.5 },
		secondary: { min: 0.5, max: 6.5 }
	};

	// First, solve layout to get available width
	const layoutSolution = solveLayoutConstraints(input, mode);
	const availableWidth = layoutSolution.textClipWidth;

	// Calculate initial font sizes based on mode
	let { primaryFontSize, secondaryFontSize } = await calculateInitialFontSizes(
		mode,
		primaryText,
		secondaryText,
		availableWidth,
		hasSecondaryText,
		fontBounds
	);

	// Optimize font sizes to fit vertically
	if (mode === 'ONE_LINE') {
		const optimized = optimizeOneLineVertically(primaryFontSize, secondaryFontSize, dimensions);
		primaryFontSize = optimized.primaryFontSize;
		secondaryFontSize = optimized.secondaryFontSize;
	} else if (mode === 'IMAGE_HORIZONTAL') {
		// Use split-half layout: divide printable area equally with 0.5mm spacing
		// Each font is independently maximized for its zone
		// Image size is already calculated correctly by calculateOptimalImageSize
		const fontSizes = await calculateImageHorizontalSplitHalfSizes(
			dimensions,
			input.hardwareImageAspectRatio ?? 1,
			fontMetricsData,
			primaryText,
			secondaryText,
			availableWidth,
			fontBounds
		);

		primaryFontSize = fontSizes.primaryFontSize;
		secondaryFontSize = fontSizes.secondaryFontSize;
	} else {
		// TWO_LINE mode: Use split-half layout with independent font optimization
		const fontSizes = await calculateSplitHalfFontSizes(
			dimensions,
			fontMetricsData,
			primaryText,
			secondaryText,
			availableWidth,
			fontBounds,
			'TWO_LINE'
		);
		primaryFontSize = fontSizes.primaryFontSize;
		secondaryFontSize = fontSizes.secondaryFontSize;
	}

	// Validate horizontal fit with final font sizes
	const validated = await validateHorizontalFit(
		mode,
		primaryText,
		secondaryText,
		primaryFontSize,
		secondaryFontSize,
		hasSecondaryText,
		availableWidth
	);
	primaryFontSize = validated.primaryFontSize;
	secondaryFontSize = validated.secondaryFontSize;

	// Re-solve with final optimized font sizes
	// For ONE_LINE and IMAGE_HORIZONTAL modes, measure primary text width for positioning secondary text
	let primaryTextWidth: number | undefined;
	if (mode === 'ONE_LINE' || mode === 'IMAGE_HORIZONTAL') {
		primaryTextWidth = await measureText(primaryText, 'Noto Sans', primaryFontSize, '900');
	}

	return solveWithFontSizes(
		input,
		primaryFontSize,
		secondaryFontSize,
		layoutSolution,
		fontMetricsData,
		mode,
		primaryTextWidth
	);
}

/**
 * Calculates optimal image size based on available space and aspect ratio
 * Returns aspect-ratio-aware dimensions for all modes
 */
function calculateOptimalImageSize(
	dimensions: LabelDimensions,
	showQRCode: boolean,
	mode: LayoutMode,
	imageAspectRatio: number = 1
): { width: number; height: number } {
	// IMAGE_HORIZONTAL mode: calculate horizontal (wide) image size
	if (mode === 'IMAGE_HORIZONTAL') {
		const availableSpace = dimensions.printableHeight - MIN_SPACING;
		let targetHeight = availableSpace / 2;

		// Reduce target slightly to account for text descent
		targetHeight = targetHeight * 0.95;

		let imageHeight = targetHeight;
		let imageWidth = imageHeight * imageAspectRatio;

		// If image is too wide, constrain by width
		const maxWidth = dimensions.printableWidth - MIN_SPACING * 2;
		if (imageWidth > maxWidth) {
			imageWidth = maxWidth;
			imageHeight = imageWidth / imageAspectRatio;
		}

		return {
			width: imageWidth,
			height: imageHeight
		};
	}

	// ONE_LINE and TWO_LINE modes: calculate vertical (tall) image size
	// Calculate maximum available height (use full printable height)
	const maxHeight = dimensions.printableHeight;

	// Calculate maximum available width considering text needs
	let availableWidth = dimensions.printableWidth;
	if (showQRCode) {
		availableWidth -= QR_SIZE + MIN_SPACING;
	}

	// Reserve space for text based on label proportions
	const labelAspectRatio = dimensions.printableWidth / dimensions.printableHeight;
	const textReserveRatio = labelAspectRatio < 3.0 ? 0.5 : labelAspectRatio < 4.0 ? 0.6 : 0.65;

	const textReserve = Math.max(MIN_TEXT_WIDTH, availableWidth * textReserveRatio);
	const maxWidth = availableWidth - textReserve - MIN_SPACING;

	// Start with height-constrained size (use full available height)
	let imageHeight = maxHeight;

	// Ensure minimum size
	imageHeight = Math.max(imageHeight, MIN_IMAGE_SIZE);

	// Calculate width based on aspect ratio
	let imageWidth = imageHeight * imageAspectRatio;

	// Constrain by available width if needed
	if (imageWidth > maxWidth) {
		imageWidth = maxWidth;
		imageHeight = imageWidth / imageAspectRatio;
	}

	return {
		width: imageWidth,
		height: imageHeight
	};
}

/**
 * Solves layout constraints to determine available space
 */
function solveLayoutConstraints(
	input: SolverInput,
	mode: LayoutMode
): {
	textStartX: number;
	textClipWidth: number;
	imageSize?: { width: number; height: number };
} {
	const { dimensions, showQRCode, showHardwareImage, hardwareImageAspectRatio } = input;

	let imageSize: { width: number; height: number } | undefined;

	// Calculate text start position based on left elements
	let textStartX = 0;
	if (showHardwareImage) {
		// Calculate optimal image size based on mode with aspect ratio
		imageSize = calculateOptimalImageSize(
			dimensions,
			showQRCode,
			mode,
			hardwareImageAspectRatio ?? 1
		);
		// In IMAGE_HORIZONTAL mode, image is at top, text starts at left edge
		// In other modes, image is on the left, text starts after it
		if (mode === 'IMAGE_HORIZONTAL') {
			textStartX = 0; // Text starts at left edge
		} else {
			textStartX = imageSize.width + MIN_SPACING; // Text starts after image
		}
	}

	// Calculate rightmost position based on right elements
	let rightmostX = dimensions.printableWidth;
	if (showQRCode) {
		rightmostX = dimensions.printableWidth - QR_SIZE - MIN_SPACING;
	}

	// Calculate available width for text
	const textClipWidth = rightmostX - textStartX;

	return {
		textStartX,
		textClipWidth,
		imageSize
	};
}

/**
 * Adds constraints for primary text positioning
 */
function buildPrimaryTextConstraints(
	solver: Solver,
	primaryTextX: Variable,
	primaryTextY: Variable,
	primaryTextTop: Variable,
	primaryTextBottom: Variable,
	primaryTextCenterY: Variable,
	primaryTextHeight: number,
	primaryFontMetrics: { ascent: number; descent: number },
	textStartX: number
) {
	const PRIMARY_ASCENT_RATIO = primaryFontMetrics.ascent;
	const PRIMARY_DESCENT_RATIO = primaryFontMetrics.descent;

	// Horizontal position (starts after left elements)
	solver.addConstraint(
		new Constraint(new Expression(primaryTextX), Operator.Eq, textStartX, Strength.required)
	);

	// Vertical relationships
	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextTop),
			Operator.Eq,
			new Expression(primaryTextY).minus(primaryTextHeight * PRIMARY_ASCENT_RATIO),
			Strength.required
		)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextBottom),
			Operator.Eq,
			new Expression(primaryTextY).plus(primaryTextHeight * PRIMARY_DESCENT_RATIO),
			Strength.required
		)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextCenterY),
			Operator.Eq,
			new Expression(primaryTextY).minus(primaryTextHeight * (PRIMARY_ASCENT_RATIO / 2)),
			Strength.required
		)
	);

	return { PRIMARY_ASCENT_RATIO, PRIMARY_DESCENT_RATIO };
}

/**
 * Adds vertical position constraints for secondary text
 */
function addSecondaryTextVerticalConstraints(
	solver: Solver,
	secondaryTextY: Variable,
	secondaryTextTop: Variable,
	secondaryTextBottom: Variable,
	secondaryTextCenterY: Variable,
	secondaryTextHeight: number,
	secondaryFontMetrics: { ascent: number; descent: number }
) {
	const SECONDARY_ASCENT_RATIO = secondaryFontMetrics.ascent;
	const SECONDARY_DESCENT_RATIO = secondaryFontMetrics.descent;

	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextTop),
			Operator.Eq,
			new Expression(secondaryTextY).minus(secondaryTextHeight * SECONDARY_ASCENT_RATIO),
			Strength.required
		)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextBottom),
			Operator.Eq,
			new Expression(secondaryTextY).plus(secondaryTextHeight * SECONDARY_DESCENT_RATIO),
			Strength.required
		)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextCenterY),
			Operator.Eq,
			new Expression(secondaryTextY).minus(secondaryTextHeight * (SECONDARY_ASCENT_RATIO / 2)),
			Strength.required
		)
	);
}

/**
 * Adds constraints for QR code positioning
 */
function buildQRConstraints(
	solver: Solver,
	qrX: Variable,
	qrY: Variable,
	dimensions: LabelDimensions
) {
	// QR code anchored to right edge
	solver.addConstraint(
		new Constraint(
			new Expression(qrX),
			Operator.Eq,
			dimensions.printableWidth - QR_SIZE,
			Strength.required
		)
	);

	// QR code vertically centered
	solver.addConstraint(
		new Constraint(
			new Expression(qrY),
			Operator.Eq,
			(dimensions.printableHeight - QR_SIZE) / 2,
			Strength.required
		)
	);
}

/**
 * Adds constraints for hardware image positioning
 */
function buildImageConstraints(
	solver: Solver,
	imageX: Variable,
	imageY: Variable,
	dimensions: LabelDimensions,
	imageSize: { width: number; height: number },
	mode: LayoutMode
) {
	if (mode === 'IMAGE_HORIZONTAL') {
		// IMAGE_HORIZONTAL mode: Image positioned horizontally
		// X position: left edge
		solver.addConstraint(new Constraint(new Expression(imageX), Operator.Eq, 0, Strength.required));

		// Y position: Computed by applyImageHorizontalConstraints using TWO_LINE centering logic
		// (Do NOT add imageY constraint here - it conflicts with centering)
	} else {
		// ONE_LINE and TWO_LINE modes: Image at left edge, vertically centered
		solver.addConstraint(new Constraint(new Expression(imageX), Operator.Eq, 0, Strength.required));

		solver.addConstraint(
			new Constraint(
				new Expression(imageY),
				Operator.Eq,
				(dimensions.printableHeight - imageSize.height) / 2,
				Strength.required
			)
		);
	}
}

/**
 * Applies shared constraints for modes where texts are on the same line
 * Used by ONE_LINE and IMAGE_HORIZONTAL modes
 */
function applySharedLineConstraints(
	solver: Solver,
	primaryTextX: Variable,
	primaryTextY: Variable,
	secondaryTextX: Variable,
	secondaryTextY: Variable,
	secondaryTextTop: Variable,
	secondaryTextBottom: Variable,
	secondaryTextCenterY: Variable,
	secondaryTextHeight: number,
	fontMetricsData: { secondary: { ascent: number; descent: number } },
	primaryTextWidth: number | undefined
) {
	// Secondary text vertical relationships
	addSecondaryTextVerticalConstraints(
		solver,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY,
		secondaryTextHeight,
		fontMetricsData.secondary
	);

	// Place both texts on the same baseline
	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextY),
			Operator.Eq,
			new Expression(secondaryTextY),
			Strength.required
		)
	);

	// Secondary text starts after primary text with spacing
	const primaryWidth = primaryTextWidth ?? MIN_SPACING;
	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextX),
			Operator.Eq,
			new Expression(primaryTextX).plus(primaryWidth).plus(MIN_SPACING),
			Strength.required
		)
	);
}

/**
 * Normalizes secondary font size based on cap-height ratio
 */
function normalizeSecondaryFontSize(secondaryFontSize: number): number {
	// Apply cap-height normalization to secondary font
	// This ensures both fonts have the same visual cap-height
	// Only available in browser environment (requires document.createElement)
	if (typeof document !== 'undefined') {
		const primaryCapHeight = getCachedCapHeight(PRIMARY_FONT.family, PRIMARY_FONT.weight);
		const secondaryCapHeight = getCachedCapHeight(SECONDARY_FONT.family, SECONDARY_FONT.weight);
		const capHeightNormalizationFactor = primaryCapHeight / secondaryCapHeight;
		return secondaryFontSize * capHeightNormalizationFactor;
	}
	return secondaryFontSize;
}

/**
 * Creates all variables needed for layout solving
 */
function createLayoutVariables() {
	return {
		primaryTextX: new Variable(),
		primaryTextY: new Variable(),
		primaryTextTop: new Variable(),
		primaryTextBottom: new Variable(),
		primaryTextCenterY: new Variable(),
		secondaryTextX: new Variable(),
		secondaryTextY: new Variable(),
		secondaryTextTop: new Variable(),
		secondaryTextBottom: new Variable(),
		secondaryTextCenterY: new Variable(),
		qrX: new Variable(),
		qrY: new Variable(),
		imageX: new Variable(),
		imageY: new Variable()
	};
}

/**
 * Applies constraints for ONE_LINE mode
 */
function applyOneLineConstraints(
	solver: Solver,
	variables: ReturnType<typeof createLayoutVariables>,
	primaryTextHeight: number,
	secondaryTextHeight: number,
	dimensions: LabelDimensions,
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	},
	primaryTextWidth: number | undefined
) {
	const {
		primaryTextX,
		primaryTextY,
		primaryTextTop,
		primaryTextBottom,
		primaryTextCenterY,
		secondaryTextX,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY
	} = variables;

	// Apply shared line constraints
	applySharedLineConstraints(
		solver,
		primaryTextX,
		primaryTextY,
		secondaryTextX,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY,
		secondaryTextHeight,
		fontMetricsData,
		primaryTextWidth
	);

	// Center the combined text line vertically
	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextCenterY),
			Operator.Eq,
			dimensions.printableHeight / 2,
			Strength.strong
		)
	);

	// Keep text within bounds
	solver.addConstraint(
		new Constraint(new Expression(primaryTextTop), Operator.Ge, 0, Strength.required)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextBottom),
			Operator.Le,
			dimensions.printableHeight,
			Strength.required
		)
	);
}

/**
 * Applies split-half layout constraints for IMAGE_HORIZONTAL mode
 * Divides printable area into equal top/bottom zones with fixed spacing
 * Scales content to fill each zone
 */
function applySplitHalfConstraints(
	solver: Solver,
	variables: ReturnType<typeof createLayoutVariables>,
	primaryTextHeight: number,
	secondaryTextHeight: number,
	dimensions: LabelDimensions,
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	},
	primaryTextWidth: number | undefined,
	imageHeight: number
) {
	const {
		primaryTextX,
		primaryTextY,
		primaryTextTop,
		secondaryTextX,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY,
		imageY
	} = variables;

	// Apply shared line constraints for horizontal positioning
	applySharedLineConstraints(
		solver,
		primaryTextX,
		primaryTextY,
		secondaryTextX,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY,
		secondaryTextHeight,
		fontMetricsData,
		primaryTextWidth
	);

	// Split-half layout:
	// Fixed 0.5mm spacing centered on the horizontal centerline
	// Example: 10mm printable height
	//   - Center: 5mm
	//   - Image bottom: 4.75mm (center - 0.25mm)
	//   - Text top: 5.25mm (center + 0.25mm)
	const FIXED_SPACING = 0.5;
	const centerY = dimensions.printableHeight / 2;
	const imageBottom = centerY - FIXED_SPACING / 2;
	const textTopEdge = centerY + FIXED_SPACING / 2;

	// Image in top zone - constrain its bottom edge
	solver.addConstraint(
		new Constraint(
			new Expression(imageY).plus(imageHeight),
			Operator.Eq,
			imageBottom,
			Strength.required
		)
	);

	// Text in bottom zone - constrain its top edge
	solver.addConstraint(
		new Constraint(new Expression(primaryTextTop), Operator.Eq, textTopEdge, Strength.required)
	);
}

/**
 * Applies constraints for TWO_LINE mode
 */
function applyTwoLineConstraints(
	solver: Solver,
	variables: ReturnType<typeof createLayoutVariables>,
	primaryTextHeight: number,
	secondaryTextHeight: number,
	dimensions: LabelDimensions,
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	},
	layoutInfo: { textStartX: number }
) {
	const {
		secondaryTextX,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY,
		primaryTextTop
	} = variables;

	// Secondary text horizontal position
	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextX),
			Operator.Eq,
			layoutInfo.textStartX,
			Strength.required
		)
	);

	// Secondary text vertical relationships
	addSecondaryTextVerticalConstraints(
		solver,
		secondaryTextY,
		secondaryTextTop,
		secondaryTextBottom,
		secondaryTextCenterY,
		secondaryTextHeight,
		fontMetricsData.secondary
	);

	// Use split-half layout (same as IMAGE_HORIZONTAL):
	// - Fixed 0.5mm spacing centered on horizontal centerline
	// - Primary text in top zone
	// - Secondary text in bottom zone
	const FIXED_SPACING = 0.5;
	const PRIMARY_ASCENT_RATIO = fontMetricsData.primary.ascent;

	// Calculate total combined height of both texts
	const primaryTextHeight_visual =
		primaryTextHeight * (PRIMARY_ASCENT_RATIO + fontMetricsData.primary.descent);
	const SECONDARY_ASCENT_RATIO = fontMetricsData.secondary.ascent;
	const secondaryTextHeight_visual =
		secondaryTextHeight * (SECONDARY_ASCENT_RATIO + fontMetricsData.secondary.descent);
	const totalContentHeight = primaryTextHeight_visual + FIXED_SPACING + secondaryTextHeight_visual;

	// Center the entire content block vertically
	const centerY = dimensions.printableHeight / 2;
	const contentStartY = centerY - totalContentHeight / 2;

	// Primary text starts at the top of centered content block
	solver.addConstraint(
		new Constraint(new Expression(primaryTextTop), Operator.Eq, contentStartY, Strength.required)
	);

	// Secondary text starts after primary text + spacing
	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextTop),
			Operator.Eq,
			contentStartY + primaryTextHeight_visual + FIXED_SPACING,
			Strength.required
		)
	);
}

/**
 * Applies constraints for single text (no secondary text)
 */
function applySingleTextConstraints(
	solver: Solver,
	variables: ReturnType<typeof createLayoutVariables>,
	dimensions: LabelDimensions
) {
	const { primaryTextCenterY, primaryTextTop, primaryTextBottom } = variables;

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextCenterY),
			Operator.Eq,
			dimensions.printableHeight / 2,
			Strength.strong
		)
	);

	solver.addConstraint(
		new Constraint(new Expression(primaryTextTop), Operator.Ge, 0, Strength.required)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextBottom),
			Operator.Le,
			dimensions.printableHeight,
			Strength.required
		)
	);
}

/**
 * Builds the final solver output from solved variables
 */
function buildSolverOutput(
	variables: ReturnType<typeof createLayoutVariables>,
	primaryFontSize: number,
	secondaryFontSize: number,
	layoutInfo: {
		textClipWidth: number;
		imageSize?: { width: number; height: number };
	},
	showQRCode: boolean,
	showHardwareImage: boolean,
	hasSecondaryText: boolean
): SolverOutput {
	const output: SolverOutput = {
		primaryText: {
			x: variables.primaryTextX.value(),
			y: variables.primaryTextY.value()
		},
		secondaryText: {
			x: variables.secondaryTextX.value(),
			y: hasSecondaryText ? variables.secondaryTextY.value() : 0
		},
		primaryFontSize,
		secondaryFontSize,
		textClipWidth: layoutInfo.textClipWidth
	};

	if (showQRCode) {
		output.qrCode = {
			x: variables.qrX.value(),
			y: variables.qrY.value(),
			width: QR_SIZE,
			height: QR_SIZE
		};
	}

	if (showHardwareImage && layoutInfo.imageSize) {
		output.hardwareImage = {
			x: variables.imageX.value(),
			y: variables.imageY.value(),
			width: layoutInfo.imageSize.width,
			height: layoutInfo.imageSize.height
		};
	}

	return output;
}

/**
 * Solves complete layout with given font sizes
 */
function solveWithFontSizes(
	input: SolverInput,
	primaryFontSize: number,
	secondaryFontSize: number,
	layoutInfo: {
		textStartX: number;
		textClipWidth: number;
		imageSize?: { width: number; height: number };
	},
	fontMetricsData: {
		primary: { ascent: number; descent: number };
		secondary: { ascent: number; descent: number };
	},
	mode: LayoutMode = 'TWO_LINE',
	primaryTextWidth?: number // Actual measured width of primary text (for IMAGE_HORIZONTAL mode)
): SolverOutput {
	const solver = new Solver();
	const { dimensions, showQRCode, showHardwareImage, secondaryText } = input;
	const hasSecondaryText = !!secondaryText;

	// Normalize secondary font size for consistent cap-height
	// ONLY for ONE_LINE mode (where both texts share a baseline)
	// For TWO_LINE and IMAGE_HORIZONTAL, fonts are independently sized to fill zones
	if (mode === 'ONE_LINE') {
		secondaryFontSize = normalizeSecondaryFontSize(secondaryFontSize);
	}

	// Calculate text heights
	const primaryTextHeight = primaryFontSize;
	const secondaryTextHeight = secondaryFontSize;

	// Create all layout variables
	const variables = createLayoutVariables();

	// Build primary text constraints
	buildPrimaryTextConstraints(
		solver,
		variables.primaryTextX,
		variables.primaryTextY,
		variables.primaryTextTop,
		variables.primaryTextBottom,
		variables.primaryTextCenterY,
		primaryTextHeight,
		fontMetricsData.primary,
		layoutInfo.textStartX
	);

	// Apply mode-specific constraints
	if (mode === 'ONE_LINE') {
		applyOneLineConstraints(
			solver,
			variables,
			primaryTextHeight,
			secondaryTextHeight,
			dimensions,
			fontMetricsData,
			primaryTextWidth
		);
	} else if (mode === 'IMAGE_HORIZONTAL') {
		applySplitHalfConstraints(
			solver,
			variables,
			primaryTextHeight,
			secondaryTextHeight,
			dimensions,
			fontMetricsData,
			primaryTextWidth,
			layoutInfo.imageSize?.height ?? 0
		);
	} else if (hasSecondaryText) {
		applyTwoLineConstraints(
			solver,
			variables,
			primaryTextHeight,
			secondaryTextHeight,
			dimensions,
			fontMetricsData,
			layoutInfo
		);
	} else {
		applySingleTextConstraints(solver, variables, dimensions);
	}

	// Add QR code constraints if needed
	if (showQRCode) {
		buildQRConstraints(solver, variables.qrX, variables.qrY, dimensions);
	}

	// Add hardware image constraints if needed
	if (showHardwareImage && layoutInfo.imageSize) {
		buildImageConstraints(
			solver,
			variables.imageX,
			variables.imageY,
			dimensions,
			layoutInfo.imageSize,
			mode
		);
	}

	// Solve the constraint system
	try {
		solver.updateVariables();
	} catch (error) {
		console.warn('Constraint solver error:', error);
		// Return fallback positions
		return {
			primaryText: {
				x: layoutInfo.textStartX,
				y: primaryFontSize * 0.8
			},
			secondaryText: {
				x: layoutInfo.textStartX,
				y: hasSecondaryText ? dimensions.printableHeight - secondaryFontSize * 0.2 : 0
			},
			primaryFontSize,
			secondaryFontSize,
			textClipWidth: layoutInfo.textClipWidth,
			...(showQRCode && {
				qrCode: {
					x: dimensions.printableWidth - QR_SIZE,
					y: (dimensions.printableHeight - QR_SIZE) / 2,
					width: QR_SIZE,
					height: QR_SIZE
				}
			}),
			...(showHardwareImage &&
				layoutInfo.imageSize && {
					hardwareImage: {
						x: 0,
						y: (dimensions.printableHeight - layoutInfo.imageSize.height) / 2,
						width: layoutInfo.imageSize.width,
						height: layoutInfo.imageSize.height
					}
				})
		};
	}

	// Debug logging for TWO_LINE mode
	if (import.meta.env.DEV && mode === 'TWO_LINE' && hasSecondaryText) {
		console.log('[Vertical Spacing Debug]', {
			printableHeight: dimensions.printableHeight,
			primaryTextTop: variables.primaryTextTop.value().toFixed(2),
			primaryTextY: variables.primaryTextY.value().toFixed(2),
			primaryTextBottom: variables.primaryTextBottom.value().toFixed(2),
			secondaryTextTop: variables.secondaryTextTop.value().toFixed(2),
			secondaryTextY: variables.secondaryTextY.value().toFixed(2),
			secondaryTextBottom: variables.secondaryTextBottom.value().toFixed(2),
			actualSpacing: (
				variables.secondaryTextTop.value() - variables.primaryTextBottom.value()
			).toFixed(2),
			primaryHeight: primaryTextHeight.toFixed(2),
			secondaryHeight: secondaryTextHeight.toFixed(2),
			totalHeight: (
				variables.secondaryTextBottom.value() - variables.primaryTextTop.value()
			).toFixed(2),
			topMargin: variables.primaryTextTop.value().toFixed(2),
			bottomMargin: (dimensions.printableHeight - variables.secondaryTextBottom.value()).toFixed(2)
		});
	}

	// Build and return final output
	return buildSolverOutput(
		variables,
		primaryFontSize,
		secondaryFontSize,
		layoutInfo,
		showQRCode,
		showHardwareImage,
		hasSecondaryText
	);
}
