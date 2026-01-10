/**
 * Würth SVG Filename Parser
 *
 * Parses Würth CAD SVG filenames to extract standard information
 * and matches them to our internal standard IDs.
 *
 * Würth filename pattern:
 * Wuerth_WIS_{productId}_{standards}_{material}_{finish}_LOD_{lod}_{view}.svg
 *
 * Examples:
 * - Wuerth_WIS_01088__25_ISO_4762DIN_912_steel_10.9_zinc_plated_LOD_High_back.svg
 * - Wuerth_WIS_009201665_DIN_931_bare_stainless_steel_A4_LOD_High_left.svg
 */

import { standards } from '$lib/data/standards';

export interface StandardDesignation {
	system: 'ISO' | 'DIN';
	code: string;
}

export interface WuerthFileInfo {
	productId: string;
	standards: StandardDesignation[];
	view: 'back' | 'left';
	lod: string;
}

/**
 * Extract the filename from a full path
 */
function extractFilename(pathOrFilename: string): string {
	const parts = pathOrFilename.split('/');
	return parts[parts.length - 1];
}

/**
 * Parse a Würth SVG filename to extract standard information
 *
 * @param filename - The Würth SVG filename (can include path)
 * @returns Parsed file info or null if not a valid Würth filename
 */
export function parseWuerthFilename(filename: string): WuerthFileInfo | null {
	if (!filename) return null;

	// Extract just the filename if a path was provided
	const name = extractFilename(filename);

	// Must start with Wuerth_WIS_
	if (!name.startsWith('Wuerth_WIS_')) {
		return null;
	}

	// Extract view (back or left) - must be before .svg
	const viewMatch = name.match(/_(back|left)\.svg$/i);
	if (!viewMatch) {
		return null;
	}
	const view = viewMatch[1].toLowerCase() as 'back' | 'left';

	// Extract LOD (e.g., LOD_High or LOD_High_1)
	const lodMatch = name.match(/LOD_(High|Medium|Low)/i);
	const lod = lodMatch ? lodMatch[1] : 'High';

	// Remove prefix and suffix to get the middle part
	// Wuerth_WIS_{productId}_{standards}_{material}_LOD_{lod}_{view}.svg
	const withoutPrefix = name.replace('Wuerth_WIS_', '');
	// Use explicit LOD values and [^_]+ to prevent ReDoS via backtracking
	const withoutSuffix = withoutPrefix.replace(
		/LOD_(?:High|Medium|Low)(?:_[^_]+)?_(back|left)\.svg$/i,
		''
	);

	// Extract product ID - it's the first part before standards
	// Product ID can contain underscores (e.g., "01088__25")
	// Standards start with ISO_ or DIN_
	const standardsStartMatch = withoutSuffix.match(/(ISO_|DIN_)/);
	if (!standardsStartMatch) {
		return null;
	}

	const standardsStartIndex = withoutSuffix.indexOf(standardsStartMatch[0]);
	const productId = withoutSuffix.substring(0, standardsStartIndex).replace(/_$/, '');

	// Extract standards part (between productId and material info)
	// Material info typically starts with lowercase or contains patterns like "steel", "bare"
	const afterProductId = withoutSuffix.substring(standardsStartIndex);

	// Parse ISO and DIN standards from the string
	const extractedStandards: StandardDesignation[] = [];

	// Pattern: ISO_{code} or DIN_{code}
	// Code can be digits, possibly with hyphen (e.g., 7380-1)
	// Note: ISO_4762DIN_912 means both ISO 4762 and DIN 912

	// First, try to match combined pattern like ISO_4762DIN_912
	const combinedPattern = /ISO_(\d+(?:-\d+)?)DIN_(\d+(?:-\d+)?)/;
	const combinedMatch = afterProductId.match(combinedPattern);

	if (combinedMatch) {
		extractedStandards.push({ system: 'ISO', code: combinedMatch[1] });
		extractedStandards.push({ system: 'DIN', code: combinedMatch[2] });
	} else {
		// Try individual patterns
		const isoPattern = /ISO_(\d+(?:-\d+)?)/g;
		const dinPattern = /DIN_(\d+(?:-\d+)?)/g;

		let match;
		while ((match = isoPattern.exec(afterProductId)) !== null) {
			extractedStandards.push({ system: 'ISO', code: match[1] });
		}
		while ((match = dinPattern.exec(afterProductId)) !== null) {
			extractedStandards.push({ system: 'DIN', code: match[1] });
		}
	}

	if (extractedStandards.length === 0) {
		return null;
	}

	return {
		productId,
		standards: extractedStandards,
		view,
		lod
	};
}

/**
 * Match Würth file info to our internal standard ID
 *
 * @param fileInfo - Parsed Würth file info
 * @returns Standard ID (e.g., "iso4762") or null if no match found
 */
export function matchWuerthToStandard(fileInfo: WuerthFileInfo): string | null {
	// Try to find a matching standard in our database
	// Prefer ISO over DIN when both are available

	// Sort standards to prefer ISO
	const sortedStandards = [...fileInfo.standards].sort((a, b) => {
		if (a.system === 'ISO' && b.system !== 'ISO') return -1;
		if (a.system !== 'ISO' && b.system === 'ISO') return 1;
		return 0;
	});

	for (const std of sortedStandards) {
		// Generate potential standard ID
		const potentialId = `${std.system.toLowerCase()}${std.code.toLowerCase()}`;

		// Check if this standard exists in our database
		const found = standards.find((s) => s.id.toLowerCase() === potentialId);
		if (found) {
			return found.id;
		}

		// Also try matching by designation
		const foundByDesignation = standards.find((s) =>
			s.designations.some(
				(d) => d.system === std.system && d.code.toLowerCase() === std.code.toLowerCase()
			)
		);
		if (foundByDesignation) {
			return foundByDesignation.id;
		}
	}

	return null;
}

export interface WuerthFilePair {
	/** Path to back view SVG (side view showing length) */
	back: string;
	/** Path to left view SVG (head view) */
	left: string;
	/** Matched standard ID */
	standardId: string;
	/** Target filename for combined SVG */
	targetFilename: string;
	/** Würth product ID */
	productId: string;
}

/**
 * Group Würth SVG files into pairs (back + left) for combining
 *
 * @param filePaths - Array of Würth SVG file paths
 * @returns Array of file pairs ready for combining
 */
export function groupWuerthFiles(filePaths: string[]): WuerthFilePair[] {
	// Parse all files and group by productId
	const byProductId = new Map<
		string,
		{
			back?: { path: string; info: WuerthFileInfo };
			left?: { path: string; info: WuerthFileInfo };
		}
	>();

	for (const filePath of filePaths) {
		const info = parseWuerthFilename(filePath);
		if (!info) continue;

		const existing = byProductId.get(info.productId) || {};

		if (info.view === 'back') {
			existing.back = { path: filePath, info };
		} else if (info.view === 'left') {
			existing.left = { path: filePath, info };
		}

		byProductId.set(info.productId, existing);
	}

	// Convert to pairs, filtering out incomplete pairs and unmatched standards
	const pairs: WuerthFilePair[] = [];

	for (const [productId, files] of byProductId) {
		// Skip if we don't have both views
		if (!files.back || !files.left) continue;

		// Try to match to a standard
		const standardId = matchWuerthToStandard(files.back.info);
		if (!standardId) continue;

		pairs.push({
			back: files.back.path,
			left: files.left.path,
			standardId,
			targetFilename: generateTargetFilename(standardId),
			productId
		});
	}

	return pairs;
}

/**
 * Generate the target SVG filename for a matched standard
 *
 * @param standardId - The matched standard ID (e.g., "iso4762", "din912")
 * @returns Target filename (e.g., "din_912.svg")
 */
export function generateTargetFilename(standardId: string): string {
	// Extract system and code from standardId
	const isoMatch = standardId.match(/^iso(\d+(?:-\d+)?)$/i);
	const dinMatch = standardId.match(/^din(\d+(?:-\d+)?)$/i);

	if (isoMatch) {
		return `iso_${isoMatch[1]}.svg`;
	}
	if (dinMatch) {
		return `din_${dinMatch[1]}.svg`;
	}

	// Fallback: just add .svg
	return `${standardId}.svg`;
}
