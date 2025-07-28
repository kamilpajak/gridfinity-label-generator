/**
 * Label Formatter Utilities
 *
 * Provides functions for formatting label text based on mode and input values
 */

/**
 * Formats the primary text for the label
 * @param labelMode - 'standard' or 'custom' mode
 * @param threadSize - Thread size (e.g., M5, M3)
 * @param length - Length value
 * @param primaryText - Custom primary text (for custom mode)
 * @returns Formatted primary text
 */
export function formatPrimaryText(
	labelMode: string,
	threadSize: string,
	length: string,
	primaryText: string
): string {
	if (labelMode === 'standard' && threadSize && length) {
		return `${threadSize} × ${length}`;
	} else if (labelMode === 'custom' && primaryText) {
		return primaryText;
	}
	return '';
}

/**
 * Formats the secondary text for the label
 * @param labelMode - 'standard' or 'custom' mode
 * @param secondaryText - Custom secondary text (for custom mode)
 * @returns Formatted secondary text
 */
export function formatSecondaryText(labelMode: string, secondaryText: string): string {
	return labelMode === 'custom' && secondaryText ? secondaryText : '';
}

/**
 * Determines if a label configuration is valid for preview
 * @param labelMode - 'standard' or 'custom' mode
 * @param threadSize - Thread size (for standard mode)
 * @param length - Length value (for standard mode)
 * @param primaryText - Primary text (for custom mode)
 * @returns Boolean indicating if label is ready for preview
 */
export function isLabelValid(
	labelMode: string,
	threadSize: string,
	length: string,
	primaryText: string
): boolean {
	if (labelMode === 'standard') {
		return !!(threadSize && length);
	} else if (labelMode === 'custom') {
		return !!primaryText;
	}
	return false;
}
