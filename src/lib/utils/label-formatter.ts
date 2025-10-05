/**
 * Label Formatter Utilities
 *
 * Provides functions for formatting label text based on mode and input values
 */

/**
 * Formats the primary text for the label
 * @param labelMode - 'fastener' or 'general' mode
 * @param threadSize - Thread size (e.g., M5, M3, #10)
 * @param length - Length value
 * @param primaryText - Custom primary text (for general mode)
 * @param pitch - Optional thread pitch (e.g., '24', '32' for imperial UNC/UNF)
 * @returns Formatted primary text
 */
export function formatPrimaryText(
	labelMode: string,
	threadSize: string,
	length: string,
	primaryText: string,
	pitch?: string
): string {
	if (labelMode === 'fastener') {
		// Format thread size with pitch if provided
		const formattedThreadSize = threadSize && pitch ? `${threadSize}-${pitch}` : threadSize;

		if (formattedThreadSize && length) {
			// Show both thread size (with pitch) and length
			return `${formattedThreadSize} × ${length}`;
		} else if (formattedThreadSize) {
			// Show only thread size with pitch (for nuts/washers or when no length specified)
			return formattedThreadSize;
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
