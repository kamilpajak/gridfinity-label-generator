/**
 * Label Constraint Solver using Kiwi.js
 *
 * This module uses constraint solving to dynamically calculate optimal positions
 * for label elements based on configuration and available space.
 * All calculations are relative to the printable area (0,0 origin).
 */

import { Solver, Variable, Constraint, Expression, Operator, Strength } from '@lume/kiwi';
import { measureText, calculateOptimalFontSize } from './text-measurer';

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
}

export interface ElementPosition {
	x: number;
	y: number;
	width?: number;
	height?: number;
}

export interface SolverOutput {
	primaryText: ElementPosition;
	secondaryText: ElementPosition;
	primaryFontSize: number; // Optimized font size for primary text
	secondaryFontSize: number; // Optimized font size for secondary text
	qrCode?: ElementPosition;
	hardwareImage?: ElementPosition;
	textClipWidth: number; // Width available for text before right elements
}

const ELEMENT_SIZE = 10; // Fixed size for QR code and hardware image (10x10mm)
const MIN_SPACING = 1; // Minimum spacing between elements (1mm)
const TEXT_VERTICAL_SPACING = 1; // Minimum vertical spacing between text lines

export function solveLabelLayout(input: SolverInput): SolverOutput {
	const { dimensions, primaryText, secondaryText } = input;
	const hasSecondaryText = !!secondaryText;

	// Define consistent font size bounds for all label sizes
	// This ensures the same text appears at the same size regardless of label dimensions
	const fontBounds = {
		primary: {
			min: 0.5, // Allow very small text to ensure it always fits
			max: 6 // Increased to allow larger text when space permits
		},
		secondary: {
			min: 0.5, // Allow very small text to ensure it always fits
			max: 5 // Increased to allow larger text when space permits
		}
	};

	// First, solve layout to get available width
	const layoutSolution = solveLayoutConstraints(input);
	const availableWidth = layoutSolution.textClipWidth;

	// Start with font sizes that fit horizontally
	let primaryFontSize = calculateOptimalFontSize(
		primaryText,
		'Noto Sans',
		'900',
		availableWidth,
		fontBounds.primary.min,
		fontBounds.primary.max
	);

	let secondaryFontSize = hasSecondaryText
		? calculateOptimalFontSize(
				secondaryText,
				'Oswald',
				'300',
				availableWidth,
				fontBounds.secondary.min,
				fontBounds.secondary.max
			)
		: fontBounds.secondary.max;

	// Optimize font sizes to fit vertically while maximizing each text independently
	let iterations = 0;
	const maxIterations = 20; // Prevent infinite loops

	while (iterations < maxIterations) {
		// Calculate text heights with current font sizes
		const primaryHeight = primaryFontSize * 1.2;
		const secondaryHeight = hasSecondaryText ? secondaryFontSize * 1.2 : 0;
		const spacing = hasSecondaryText ? TEXT_VERTICAL_SPACING : 0;
		const totalHeight = primaryHeight + spacing + secondaryHeight;

		// Use full available height - text can touch edges
		const maxAllowedHeight = dimensions.printableHeight;

		if (totalHeight <= maxAllowedHeight) {
			// Text fits, we're done with shrinking
			break;
		}

		// Calculate how much we need to shrink
		const excessHeight = totalHeight - maxAllowedHeight;

		// Determine which text to shrink based on their relative sizes
		if (hasSecondaryText) {
			// Distribute shrinking based on which text is larger relative to its max
			const primaryRatio = primaryFontSize / fontBounds.primary.max;
			const secondaryRatio = secondaryFontSize / fontBounds.secondary.max;

			if (primaryRatio > secondaryRatio) {
				// Primary is relatively larger, shrink it more
				const primaryShrink = Math.min(excessHeight * 0.8, primaryHeight * 0.1);
				primaryFontSize = primaryFontSize * (1 - primaryShrink / primaryHeight);
			} else {
				// Secondary is relatively larger, shrink it more
				const secondaryShrink = Math.min(excessHeight * 0.8, secondaryHeight * 0.1);
				secondaryFontSize = secondaryFontSize * (1 - secondaryShrink / secondaryHeight);
			}
		} else {
			// Only primary text, scale it down
			const scale = maxAllowedHeight / totalHeight;
			primaryFontSize = primaryFontSize * scale;
		}

		// Ensure we don't go below absolute minimum
		primaryFontSize = Math.max(primaryFontSize, 0.5);
		secondaryFontSize = Math.max(secondaryFontSize, 0.5);

		iterations++;
	}

	// Final optimization pass: try to grow each text independently
	if (hasSecondaryText) {
		// Check if we can grow secondary text
		const currentPrimaryHeight = primaryFontSize * 1.2;
		const availableForSecondary =
			dimensions.printableHeight - currentPrimaryHeight - TEXT_VERTICAL_SPACING;
		const maxSecondaryHeight = availableForSecondary / 1.2;
		const maxSecondarySize = Math.min(maxSecondaryHeight, fontBounds.secondary.max);

		// Also check horizontal constraint for secondary
		secondaryFontSize = calculateOptimalFontSize(
			secondaryText,
			'Oswald',
			'300',
			availableWidth,
			secondaryFontSize,
			maxSecondarySize
		);
	}

	// Double-check horizontal fit with final font sizes and adjust independently
	const primaryWidth = measureText(primaryText, 'Noto Sans', primaryFontSize, '900');
	if (primaryWidth > availableWidth) {
		const horizontalScale = availableWidth / primaryWidth;
		primaryFontSize = Math.max(primaryFontSize * horizontalScale, 0.5);
	}

	if (hasSecondaryText) {
		const secondaryWidth = measureText(secondaryText, 'Oswald', secondaryFontSize, '300');
		if (secondaryWidth > availableWidth) {
			const horizontalScale = availableWidth / secondaryWidth;
			secondaryFontSize = Math.max(secondaryFontSize * horizontalScale, 0.5);
		}
	}

	// Re-solve with final optimized font sizes
	return solveWithFontSizes(input, primaryFontSize, secondaryFontSize, layoutSolution);
}

/**
 * Solves layout constraints to determine available space
 */
function solveLayoutConstraints(input: SolverInput): { textClipWidth: number; rightmostX: number } {
	const { dimensions, showQRCode, showHardwareImage } = input;

	// Calculate rightmost element position
	let rightmostX = dimensions.printableWidth;

	if (showQRCode) {
		rightmostX = dimensions.printableWidth - ELEMENT_SIZE;
	}

	if (showHardwareImage) {
		if (showQRCode) {
			// Image is left of QR code with spacing
			rightmostX = dimensions.printableWidth - 2 * ELEMENT_SIZE - MIN_SPACING;
		} else {
			// Image is at right edge
			rightmostX = dimensions.printableWidth - ELEMENT_SIZE;
		}
	}

	return {
		textClipWidth: rightmostX - MIN_SPACING,
		rightmostX
	};
}

/**
 * Solves complete layout with given font sizes
 */
function solveWithFontSizes(
	input: SolverInput,
	primaryFontSize: number,
	secondaryFontSize: number,
	layoutInfo: { textClipWidth: number; rightmostX: number }
): SolverOutput {
	const solver = new Solver();
	const { dimensions, showQRCode, showHardwareImage, secondaryText } = input;
	const hasSecondaryText = !!secondaryText;

	// Calculate text heights based on optimized font sizes
	const primaryTextHeight = primaryFontSize * 1.2; // Add line height factor
	const secondaryTextHeight = secondaryFontSize * 1.2;

	// Create variables for primary text
	const primaryTextX = new Variable();
	const primaryTextY = new Variable(); // This will be the baseline position
	const primaryTextTop = new Variable();
	const primaryTextBottom = new Variable();
	const primaryTextCenterY = new Variable();

	// Create variables for secondary text
	const secondaryTextX = new Variable();
	const secondaryTextY = new Variable(); // Baseline position
	const secondaryTextTop = new Variable();
	const secondaryTextBottom = new Variable();
	const secondaryTextCenterY = new Variable();

	// Variables for right elements (QR and/or image)
	const qrX = new Variable();
	const qrY = new Variable();
	const imageX = new Variable();
	const imageY = new Variable();

	// Primary text horizontal position (always left-aligned)
	solver.addConstraint(
		new Constraint(new Expression(primaryTextX), Operator.Eq, 0, Strength.required)
	);

	// Primary text vertical relationships
	// Note: In SVG, text Y is the baseline, so top = Y - height
	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextTop),
			Operator.Eq,
			new Expression(primaryTextY).minus(primaryTextHeight * 0.8), // Approximate ascent
			Strength.required
		)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextBottom),
			Operator.Eq,
			new Expression(primaryTextY).plus(primaryTextHeight * 0.2), // Approximate descent
			Strength.required
		)
	);

	solver.addConstraint(
		new Constraint(
			new Expression(primaryTextCenterY),
			Operator.Eq,
			new Expression(primaryTextY).minus(primaryTextHeight * 0.3), // Approximate visual center
			Strength.required
		)
	);

	// Secondary text horizontal position (always left-aligned)
	solver.addConstraint(
		new Constraint(new Expression(secondaryTextX), Operator.Eq, 0, Strength.required)
	);

	if (hasSecondaryText) {
		// Secondary text vertical relationships
		solver.addConstraint(
			new Constraint(
				new Expression(secondaryTextTop),
				Operator.Eq,
				new Expression(secondaryTextY).minus(secondaryTextHeight * 0.8),
				Strength.required
			)
		);

		solver.addConstraint(
			new Constraint(
				new Expression(secondaryTextBottom),
				Operator.Eq,
				new Expression(secondaryTextY).plus(secondaryTextHeight * 0.2),
				Strength.required
			)
		);

		solver.addConstraint(
			new Constraint(
				new Expression(secondaryTextCenterY),
				Operator.Eq,
				new Expression(secondaryTextY).minus(secondaryTextHeight * 0.3),
				Strength.required
			)
		);

		// Vertical spacing constraints for two texts
		// Primary text must be above secondary text with minimum spacing
		solver.addConstraint(
			new Constraint(
				new Expression(primaryTextBottom).plus(TEXT_VERTICAL_SPACING),
				Operator.Le,
				secondaryTextTop,
				Strength.required
			)
		);

		// Align text to edges for maximum space usage
		// Primary text touches top edge
		solver.addConstraint(
			new Constraint(new Expression(primaryTextTop), Operator.Eq, 0, Strength.strong)
		);

		// Secondary text touches bottom edge
		solver.addConstraint(
			new Constraint(
				new Expression(secondaryTextBottom),
				Operator.Eq,
				dimensions.printableHeight,
				Strength.strong
			)
		);
	} else {
		// Single text - center it vertically
		solver.addConstraint(
			new Constraint(
				new Expression(primaryTextCenterY),
				Operator.Eq,
				dimensions.printableHeight / 2,
				Strength.strong
			)
		);

		// Ensure it fits within bounds
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

	// QR Code constraints
	if (showQRCode) {
		// QR code anchored to right edge
		solver.addConstraint(
			new Constraint(
				new Expression(qrX),
				Operator.Eq,
				dimensions.printableWidth - ELEMENT_SIZE,
				Strength.required
			)
		);

		// QR code vertically centered
		solver.addConstraint(
			new Constraint(
				new Expression(qrY),
				Operator.Eq,
				(dimensions.printableHeight - ELEMENT_SIZE) / 2,
				Strength.required
			)
		);
	}

	// Hardware image constraints
	if (showHardwareImage) {
		if (showQRCode) {
			// Image is left of QR code with spacing
			solver.addConstraint(
				new Constraint(
					new Expression(imageX),
					Operator.Eq,
					dimensions.printableWidth - 2 * ELEMENT_SIZE - MIN_SPACING,
					Strength.required
				)
			);
		} else {
			// Image is at right edge
			solver.addConstraint(
				new Constraint(
					new Expression(imageX),
					Operator.Eq,
					dimensions.printableWidth - ELEMENT_SIZE,
					Strength.required
				)
			);
		}

		// Image vertically centered
		solver.addConstraint(
			new Constraint(
				new Expression(imageY),
				Operator.Eq,
				(dimensions.printableHeight - ELEMENT_SIZE) / 2,
				Strength.required
			)
		);
	}

	// Solve the system
	try {
		solver.updateVariables();
	} catch (error) {
		console.warn('Constraint solver error:', error);
		// Fallback: position texts at top with minimal spacing
		// This ensures we always return valid positions
		return {
			primaryText: {
				x: 0,
				y: primaryFontSize * 0.8 // Baseline position at top
			},
			secondaryText: {
				x: 0,
				y: hasSecondaryText ? dimensions.printableHeight - secondaryFontSize * 0.2 : 0 // Baseline at bottom
			},
			primaryFontSize,
			secondaryFontSize,
			textClipWidth: layoutInfo.textClipWidth,
			...(showQRCode && {
				qrCode: {
					x: dimensions.printableWidth - ELEMENT_SIZE,
					y: (dimensions.printableHeight - ELEMENT_SIZE) / 2,
					width: ELEMENT_SIZE,
					height: ELEMENT_SIZE
				}
			}),
			...(showHardwareImage && {
				hardwareImage: {
					x: showQRCode
						? dimensions.printableWidth - 2 * ELEMENT_SIZE - MIN_SPACING
						: dimensions.printableWidth - ELEMENT_SIZE,
					y: (dimensions.printableHeight - ELEMENT_SIZE) / 2,
					width: ELEMENT_SIZE,
					height: ELEMENT_SIZE
				}
			})
		};
	}

	// Build output
	const output: SolverOutput = {
		primaryText: {
			x: primaryTextX.value(),
			y: primaryTextY.value()
		},
		secondaryText: {
			x: secondaryTextX.value(),
			y: hasSecondaryText ? secondaryTextY.value() : 0
		},
		primaryFontSize,
		secondaryFontSize,
		textClipWidth: layoutInfo.textClipWidth
	};

	if (showQRCode) {
		output.qrCode = {
			x: qrX.value(),
			y: qrY.value(),
			width: ELEMENT_SIZE,
			height: ELEMENT_SIZE
		};
	}

	if (showHardwareImage) {
		output.hardwareImage = {
			x: imageX.value(),
			y: imageY.value(),
			width: ELEMENT_SIZE,
			height: ELEMENT_SIZE
		};
	}

	return output;
}
