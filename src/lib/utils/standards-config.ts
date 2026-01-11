/**
 * Standards Config v2 Utilities
 *
 * Utility functions for working with the new standards-config.json structure.
 * The v2 structure uses per-system sections (iso, din, ansi, etc.) instead of
 * crossref/dinOnly sections.
 *
 * @see docs/plan-standards-config-migration.md
 */

/**
 * Supported standard systems.
 * Future systems (ANSI, PN, GB, JIS) are included for extensibility.
 */
export type StandardSystem = 'iso' | 'din' | 'ansi' | 'pn' | 'gb' | 'jis';

/**
 * All valid system prefixes for parsing/validation.
 * NOTE: Keep in sync with scripts/standards-validate.js and scripts/standards-resolve.js
 */
export const VALID_SYSTEMS: readonly StandardSystem[] = [
	'iso',
	'din',
	'ansi',
	'pn',
	'gb',
	'jis'
] as const;

/**
 * Regex pattern for parsing standard IDs.
 * Matches: iso4762, din912, din7504k, ansi123, etc.
 */
const STANDARD_ID_PATTERN = /^(iso|din|ansi|pn|gb|jis)(\d+[a-z]?)$/i;

/**
 * Entry for a single standard in the config.
 *
 * Cross-references to other systems are stored as arrays of number strings.
 * Only present fields have values (no empty arrays).
 */
export interface StandardEntry {
	/** Cross-reference to DIN standards */
	din?: string[];
	/** Cross-reference to ISO standards */
	iso?: string[];
	/** Cross-reference to ANSI standards */
	ansi?: string[];
	/** Cross-reference to PN standards */
	pn?: string[];
	/** Cross-reference to GB standards */
	gb?: string[];
	/** Cross-reference to JIS standards */
	jis?: string[];
	/** True if standard is withdrawn */
	withdrawn?: boolean;
	/** Full ID of replacement standard (e.g., "iso10642") */
	replacedBy?: string;
}

/**
 * Standards config v2 structure.
 *
 * Each top-level key is a system (iso, din, etc.) containing a map of
 * standard numbers to their entries.
 *
 * @example
 * {
 *   "iso": {
 *     "4762": { "din": ["912"] },
 *     "1051": { "din": ["660"], "withdrawn": true }
 *   },
 *   "din": {
 *     "95": {},
 *     "7991": { "withdrawn": true, "replacedBy": "iso10642" }
 *   }
 * }
 */
export interface StandardsConfigV2 {
	iso?: Record<string, StandardEntry>;
	din?: Record<string, StandardEntry>;
	ansi?: Record<string, StandardEntry>;
	pn?: Record<string, StandardEntry>;
	gb?: Record<string, StandardEntry>;
	jis?: Record<string, StandardEntry>;
	/** Index signature for runtime validation of unknown keys */
	[key: string]: Record<string, StandardEntry> | undefined;
}

/**
 * Parse full standard ID to system and number.
 *
 * @param fullId - Full standard ID (e.g., "iso4762", "din912", "din7504k")
 * @returns Parsed system and number, or null if invalid
 *
 * @example
 * parseStandardId("iso4762") // { system: "iso", number: "4762" }
 * parseStandardId("din7504k") // { system: "din", number: "7504k" }
 * parseStandardId("invalid") // null
 */
export function parseStandardId(fullId: string): { system: StandardSystem; number: string } | null {
	if (!fullId || typeof fullId !== 'string') {
		return null;
	}

	const match = STANDARD_ID_PATTERN.exec(fullId);
	if (!match) {
		return null;
	}

	return {
		system: match[1].toLowerCase() as StandardSystem,
		number: match[2]
	};
}

/**
 * Build full standard ID from system and number.
 *
 * @param system - Standard system (iso, din, etc.)
 * @param number - Standard number (may include letter suffix)
 * @returns Full standard ID
 *
 * @example
 * buildStandardId("iso", "4762") // "iso4762"
 * buildStandardId("din", "7504k") // "din7504k"
 */
export function buildStandardId(system: StandardSystem, number: string): string {
	return `${system}${number}`;
}

/**
 * Extract all standard IDs from v2 config.
 *
 * Iterates over all system sections and builds full IDs.
 *
 * @param config - Standards config v2
 * @returns Array of full standard IDs (e.g., ["iso4762", "din912"])
 *
 * @example
 * extractAllStandardIds({ iso: { "4762": {} }, din: { "912": {} } })
 * // ["iso4762", "din912"]
 */
export function extractAllStandardIds(config: StandardsConfigV2): string[] {
	const ids: string[] = [];

	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (section) {
			for (const number of Object.keys(section)) {
				ids.push(buildStandardId(system, number));
			}
		}
	}

	return ids;
}

/**
 * Get standard entry from v2 config.
 *
 * @param config - Standards config v2
 * @param fullId - Full standard ID (e.g., "iso4762")
 * @returns Standard entry or undefined if not found
 *
 * @example
 * getStandardEntry(config, "iso4762") // { din: ["912"] }
 * getStandardEntry(config, "iso9999") // undefined
 */
export function getStandardEntry(
	config: StandardsConfigV2,
	fullId: string
): StandardEntry | undefined {
	const parsed = parseStandardId(fullId);
	if (!parsed) {
		return undefined;
	}

	return config[parsed.system]?.[parsed.number];
}

/**
 * Check if standard is withdrawn.
 *
 * @param config - Standards config v2
 * @param fullId - Full standard ID (e.g., "iso4762")
 * @returns True if standard is marked as withdrawn, false otherwise
 *
 * @example
 * isWithdrawn(config, "din127") // true (if withdrawn: true)
 * isWithdrawn(config, "iso4762") // false
 * isWithdrawn(config, "iso9999") // false (not found)
 */
export function isWithdrawn(config: StandardsConfigV2, fullId: string): boolean {
	const entry = getStandardEntry(config, fullId);
	return entry?.withdrawn === true;
}
