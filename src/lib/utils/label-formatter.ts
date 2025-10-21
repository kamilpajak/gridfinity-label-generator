/**
 * Label Formatter Utilities
 *
 * Provides functions for formatting label text based on mode and input values
 */

import { HardwareType } from '$lib/data/standards';

/**
 * Formats thread designation with pitch and type
 * @param threadSize - Thread size (e.g., M5, M3, #10, 1/4)
 * @param pitch - Optional thread pitch (e.g., '0.5', '1.5' for metric mm, '24', '32' for imperial TPI)
 * @param threadType - Optional thread type (e.g., 'UNC', 'UNF' for imperial)
 * @param hardwareType - Optional hardware type to determine if 'M' prefix should be stripped
 * @returns Formatted thread designation
 */
function formatThreadDesignation(
	threadSize: string,
	pitch?: string,
	threadType?: string,
	hardwareType?: string
): string {
	const isMetric = threadSize.toUpperCase().startsWith('M');

	// For wood screws, strip the 'M' prefix (wood screws don't use metric thread designation)
	let formatted = threadSize;
	if (hardwareType === HardwareType.WOOD_SCREW && isMetric) {
		formatted = threadSize.substring(1); // Remove 'M' prefix
	}

	if (pitch) {
		// Metric: use × (multiplication sign) - M5 × 0.5
		// Imperial: use − (minus sign) - 3/8−16 (per ASME B1.1)
		const pitchSeparator = isMetric ? ' × ' : '−';
		formatted = `${threadSize}${pitchSeparator}${pitch}`;

		// Add UNC/UNF designation for imperial threads when pitch is explicitly selected
		if (!isMetric && threadType && (threadType === 'UNC' || threadType === 'UNF')) {
			formatted = `${formatted} ${threadType}`;
		}
	}

	return formatted;
}

/**
 * Formats the primary text for the label
 * @param labelMode - 'fastener' or 'general' mode
 * @param threadSize - Thread size (e.g., M5, M3, #10, 1/4)
 * @param length - Length value
 * @param primaryText - Custom primary text (for general mode)
 * @param pitch - Optional thread pitch (e.g., '0.5', '1.5' for metric mm, '24', '32' for imperial TPI)
 * @param threadType - Optional thread type (e.g., 'UNC', 'UNF' for imperial, 'standard', 'fine' for metric)
 * @param hardwareType - Optional hardware type to determine formatting rules
 * @returns Formatted primary text
 */
export function formatPrimaryText(
	labelMode: string,
	threadSize: string,
	length: string,
	primaryText: string,
	pitch?: string,
	threadType?: string,
	hardwareType?: string
): string {
	if (labelMode === 'fastener') {
		const isMetric = threadSize.toUpperCase().startsWith('M');
		const formattedThread = formatThreadDesignation(threadSize, pitch, threadType, hardwareType);

		if (formattedThread && length) {
			// Show both thread size (with pitch) and length
			// Both metric and imperial: use × (multiplication sign) for better visual appearance
			// Metric: M5 × 0.5 × 20
			// Imperial: 3/8−16 UNC × 2"
			const lengthSuffix = isMetric ? '' : '"';
			return `${formattedThread} × ${length}${lengthSuffix}`;
		} else if (formattedThread) {
			// Show only thread size with pitch (for nuts/washers or when no length specified)
			return formattedThread;
		}
	} else if (labelMode === 'general' && primaryText) {
		return primaryText;
	}
	return '';
}

/**
 * Formats the secondary text for the label
 * @param labelMode - 'fastener' or 'general' mode
 * @param secondaryText - Custom secondary text (for general mode)
 * @returns Formatted secondary text
 */
export function formatSecondaryText(labelMode: string, secondaryText: string): string {
	return labelMode === 'general' && secondaryText ? secondaryText : '';
}

/**
 * Determines if a label configuration is valid for preview
 * @param labelMode - 'fastener' or 'general' mode
 * @param threadSize - Thread size (for fastener mode)
 * @param length - Length value (for fastener mode)
 * @param primaryText - Primary text (for general mode)
 * @returns Boolean indicating if label is ready for preview
 */
export function isLabelValid(
	labelMode: string,
	threadSize: string,
	length: string,
	primaryText: string
): boolean {
	if (labelMode === 'fastener') {
		return !!(threadSize && length);
	} else if (labelMode === 'general') {
		return !!primaryText;
	}
	return false;
}
