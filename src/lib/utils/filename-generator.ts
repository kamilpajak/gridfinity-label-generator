/**
 * Label Filename Generator
 *
 * Generates descriptive filenames for exported labels based on their configuration.
 */

import type { ISODINStandard } from '$lib/data/standards';

export interface FilenameOptions {
	labelMode: 'fastener' | 'general';
	standard?: ISODINStandard;
	threadSize?: string;
	length?: string;
	primaryText?: string;
	secondaryText?: string;
	printableWidth: number;
	printableHeight: number;
}

/**
 * Generates a descriptive filename for label export
 */
export function generateLabelFilename(options: FilenameOptions): string {
	const { labelMode, standard, threadSize, length, primaryText, secondaryText } = options;

	if (labelMode === 'fastener') {
		return generateFastenerFilename(standard, threadSize, length);
	} else {
		return generateGeneralFilename(primaryText, secondaryText);
	}
}

/**
 * Generates filename for fastener labels
 * Format: STANDARD_THREADSIZExLENGTH.png
 * Examples: DIN912_M6x20mm.png, ISO4762_M8x30mm.png, DIN125_M6.png
 */
function generateFastenerFilename(
	standard: ISODINStandard | undefined,
	threadSize: string | undefined,
	length: string | undefined
): string {
	// Fallback if standard is missing
	if (!standard) {
		return `Fastener.png`;
	}

	// Get designation - prefer first designation (often most specific)
	// Fallback to primary system match if needed
	const primaryDesignation =
		standard.designations[0] ||
		standard.designations.find((d) => d.system === standard.primarySystem);
	const standardCode = primaryDesignation
		? `${primaryDesignation.system}${primaryDesignation.code}`
		: standard.id.toUpperCase();

	// Sanitize standard code (keep dots for standards like ASME B18.3)
	const sanitizedStandard = sanitizeStandardCode(standardCode);

	// Detect if imperial or metric based on thread size
	const isImperial = threadSize?.includes('"') || threadSize?.includes('in') || false;

	// Sanitize thread size (replace special characters)
	const sanitizedThreadSize = threadSize ? sanitizeThreadSize(threadSize) : '';

	// Build filename parts
	const parts = [sanitizedStandard];

	if (sanitizedThreadSize) {
		// Add length if present (screws/bolts have length, nuts/washers don't)
		if (length && length.trim() !== '') {
			const sanitizedLength = sanitizeThreadSize(length);
			const unit = isImperial ? 'in' : 'mm';
			parts.push(`${sanitizedThreadSize}x${sanitizedLength}${unit}`);
		} else {
			parts.push(sanitizedThreadSize);
		}
	}

	return `${parts.join('_')}.png`;
}

/**
 * Generates filename for general item labels
 * Format: PRIMARY_TEXT_SECONDARY_TEXT.png (if secondary text exists)
 * Format: PRIMARY_TEXT.png (if no secondary text)
 * Examples: Resistors_100Ohm.png, Resistors.png, SmallParts.png
 */
function generateGeneralFilename(
	primaryText: string | undefined,
	secondaryText: string | undefined
): string {
	// Use primary text if available, otherwise fallback to generic name
	const primary = primaryText && primaryText.trim() !== '' ? primaryText : 'Label';
	const sanitizedPrimary = sanitizeForFilename(primary);

	// If secondary text exists and is non-empty, include it
	if (secondaryText && secondaryText.trim() !== '') {
		const sanitizedSecondary = sanitizeForFilename(secondaryText);
		// Combine both texts with underscore
		const combined = `${sanitizedPrimary}_${sanitizedSecondary}`;
		const truncated = truncateText(combined, 40);
		return `${truncated}.png`;
	}

	// Just primary text
	const truncated = truncateText(sanitizedPrimary, 30);
	return `${truncated}.png`;
}

/**
 * Sanitizes standard code for filename
 * - Keeps dots (for standards like ASME B18.3)
 * - Removes spaces and other special characters
 */
function sanitizeStandardCode(text: string): string {
	return text
		.replaceAll(/[^\w\s.-]/g, '') // Remove special chars except spaces, dots, hyphens
		.replaceAll(/\s+/g, '') // Remove spaces
		.replaceAll(/-+/g, ''); // Remove hyphens (also handles start/end)
}

/**
 * Sanitizes text for use in filenames
 * - Removes special characters except hyphens
 * - Replaces spaces with nothing (camelCase effect)
 * - Keeps alphanumeric characters
 */
function sanitizeForFilename(text: string): string {
	return text
		.replaceAll(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
		.replaceAll(/\s+/g, '') // Remove spaces
		.replaceAll(/-+/g, ''); // Remove hyphens (also handles start/end)
}

/**
 * Sanitizes thread size for filename
 * - Converts fractions: 1/4" -> 1-4in
 * - Removes quotes and special characters
 */
function sanitizeThreadSize(threadSize: string): string {
	return threadSize
		.replaceAll('"', 'in') // Replace quote with 'in'
		.replaceAll('/', '-') // Replace slash with hyphen
		.replaceAll(/[^\w-]/g, ''); // Remove other special chars
}

/**
 * Truncates text to maximum length, preferring word boundaries
 * - If text fits within maxLength, returns as-is
 * - If truncation needed, tries to break at last word boundary
 * - Falls back to hard truncation if no word boundary found
 */
function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	// Try to find last word boundary (space, underscore, or camelCase transition)
	const truncated = text.substring(0, maxLength);

	// Look for common separators
	const lastSpace = truncated.lastIndexOf(' ');
	const lastUnderscore = truncated.lastIndexOf('_');

	// Use the latest separator found
	const lastSeparator = Math.max(lastSpace, lastUnderscore);

	// If we found a separator and it's not too close to the start, use it
	if (lastSeparator > maxLength * 0.6) {
		return truncated.substring(0, lastSeparator);
	}

	// Otherwise, hard truncate at maxLength
	return truncated;
}
