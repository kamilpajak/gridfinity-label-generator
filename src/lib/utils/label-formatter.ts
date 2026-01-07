/**
 * Label Formatter Utilities
 *
 * Provides functions for formatting label text based on mode and input values
 */

import { HardwareType } from '$lib/data/standards';

/**
 * Checks if a thread size uses metric units (mm, not inches)
 * Includes:
 * - M-series (M3, M4, M5...)
 * - ST-series (ST2.2, ST3.5, ST4.2...)
 * - Wood screw diameters (3, 3.5, 4, 4.5...) - plain decimal numbers
 */
function isMetricSize(threadSize: string): boolean {
	const upper = threadSize.toUpperCase();

	// M-series or ST-series
	if (upper.startsWith('M') || upper.startsWith('ST')) {
		return true;
	}

	// Wood screw sizes: plain decimal numbers (3, 3.5, 4, 4.5, 5, 6, 8, 10)
	// Not imperial if: no # prefix, no / fraction, is a valid number
	if (!threadSize.startsWith('#') && !threadSize.includes('/')) {
		const num = Number.parseFloat(threadSize);
		if (!Number.isNaN(num) && num > 0) {
			return true;
		}
	}

	return false;
}

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
	const isMetric = isMetricSize(threadSize);
	const startsWithM = threadSize.toUpperCase().startsWith('M');

	// For self-tapping screws with M prefix, strip the 'M' (they use nominal diameter)
	// ST sizes keep their prefix as-is
	let formatted = threadSize;
	if (hardwareType === HardwareType.SELF_TAPPING && startsWithM) {
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
		const isMetric = isMetricSize(threadSize);
		const formattedThread = formatThreadDesignation(threadSize, pitch, threadType, hardwareType);

		if (formattedThread && length) {
			// Show both thread size (with pitch) and length
			// Both metric and imperial: use × (multiplication sign) for better visual appearance
			// Metric: M5 × 0.5 × 20
			// Imperial: 3/8−16 UNC × 2"
			const lengthSuffix = isMetric ? '' : '″';
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
 * Appends optional note to base text
 * @param baseText - Base text (e.g., standard designation or secondary text)
 * @param note - Optional note to append
 * @returns Combined text, properly formatted without leading/trailing spaces
 */
export function appendOptionalNote(baseText: string, note: string | undefined): string {
	if (!note) return baseText;
	return baseText ? `${baseText} ${note}` : note;
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
