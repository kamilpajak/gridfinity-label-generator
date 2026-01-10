/**
 * Utility functions for batch SVG processing
 *
 * These functions are used by the batch-combine-svg.js CLI script
 * and are extracted here for testability.
 */

export interface SvgFilePair {
	back: string;
	left: string;
	outputName: string;
}

/**
 * Extract standard code from Würth filename
 * e.g., "Wuerth_WIS_008610_100_DIN_6912_steel..." → "din_6912"
 */
export function extractStandardCode(filename: string): string | null {
	// Match ISO_XXXX or DIN_XXXX pattern
	const isoMatch = filename.match(/ISO_(\d+(?:-\d+)?)/i);
	const dinMatch = filename.match(/DIN_(\d+(?:-\d+)?)/i);

	if (isoMatch) {
		return `iso_${isoMatch[1]}`;
	}
	if (dinMatch) {
		return `din_${dinMatch[1]}`;
	}

	return null;
}

/**
 * Get base name for grouping (everything before _BACK or _LEFT)
 */
export function getBaseName(filename: string): string {
	return filename.replace(/_(BACK|LEFT)\.svg$/i, '');
}

/**
 * Group SVG files into pairs
 */
export function groupFiles(files: string[]): SvgFilePair[] {
	const groups = new Map<string, { back?: string; left?: string }>();

	for (const file of files) {
		const lower = file.toLowerCase();
		if (!lower.endsWith('_back.svg') && !lower.endsWith('_left.svg')) {
			continue;
		}

		const base = getBaseName(file);
		const existing = groups.get(base) || {};

		if (lower.endsWith('_back.svg')) {
			existing.back = file;
		} else if (lower.endsWith('_left.svg')) {
			existing.left = file;
		}

		groups.set(base, existing);
	}

	// Filter to only complete pairs
	const pairs: SvgFilePair[] = [];
	for (const [base, files] of groups) {
		if (files.back && files.left) {
			const standardCode = extractStandardCode(base);
			if (standardCode) {
				pairs.push({
					back: files.back,
					left: files.left,
					outputName: `${standardCode}.svg`
				});
			}
		}
	}

	return pairs;
}
