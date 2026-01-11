/**
 * DIN Media Search Utilities
 *
 * Utility functions for searching standards on DIN Media.
 * DIN Media is the single source of truth for both DIN and ISO standards.
 *
 * Key insight: ISO standards are available on DIN Media as "DIN EN ISO xxxx"
 * (European harmonized versions), so we search for "EN ISO xxxx" pattern.
 *
 * @see docs/plan-standards-validation-pipeline.md
 */

/**
 * Standards config structure
 */
interface StandardsConfig {
	crossref: Record<string, unknown>;
	dinOnly: Record<string, unknown>;
}

/**
 * Check if a standard ID is an ISO standard
 *
 * @param id - Standard ID (e.g., "iso4762", "din912")
 * @returns true if ISO standard
 */
export function isIsoStandard(id: string): boolean {
	if (!id || typeof id !== 'string') return false;
	return id.toLowerCase().startsWith('iso');
}

/**
 * Check if a standard ID is a DIN standard
 *
 * @param id - Standard ID (e.g., "din912", "iso4762")
 * @returns true if DIN standard
 */
export function isDinStandard(id: string): boolean {
	if (!id || typeof id !== 'string') return false;
	return id.toLowerCase().startsWith('din');
}

/**
 * Convert standard ID to DIN Media search query
 *
 * For DIN standards: "din912" -> "DIN 912"
 * For ISO standards: "iso4762" -> "EN ISO 4762" (European adoption)
 *
 * @param id - Standard ID like "iso4762" or "din912"
 * @returns Search query string or null if invalid
 */
export function standardIdToSearchQuery(id: string): string | null {
	if (!id || typeof id !== 'string') return null;

	// Extract prefix (din, iso) and number
	const match = id.toLowerCase().match(/^(din|iso)(\d+)([a-z])?$/i);
	if (!match) return null;

	const prefix = match[1].toLowerCase();
	const number = match[2];
	// Ignore variant suffix (k, m, o, p, etc.) - search for base standard

	if (prefix === 'din') {
		return `DIN ${number}`;
	} else if (prefix === 'iso') {
		// Search for European harmonized version: "EN ISO xxxx"
		// DIN Media has ISO standards as "DIN EN ISO xxxx"
		return `EN ISO ${number}`;
	}

	return null;
}

/**
 * Extract all standard IDs from standards config
 *
 * Combines IDs from both crossref and dinOnly sections.
 *
 * @param config - Standards config object
 * @returns Array of standard IDs (lowercase)
 */
export function extractStandardIdsFromConfig(config: StandardsConfig): string[] {
	const ids: string[] = [];

	// Extract from crossref section (ISO standards with DIN equivalents)
	for (const id of Object.keys(config.crossref || {})) {
		ids.push(id.toLowerCase());
	}

	// Extract from dinOnly section (DIN standards without ISO equivalent)
	for (const id of Object.keys(config.dinOnly || {})) {
		ids.push(id.toLowerCase());
	}

	return ids;
}
