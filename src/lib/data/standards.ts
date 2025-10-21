/**
 * ISO/DIN Standards Data
 *
 * This file contains the master list of all hardware standards supported by the Gridfinity Label Generator.
 * Each standard includes its designation, description, and applicable hardware types.
 *
 * Purpose:
 * - Central repository for all ISO/DIN standard definitions
 * - Type-safe data structure ensuring consistency across the application
 * - Supports quick lookup and selection in the UI
 *
 * Usage:
 * - Import this data into components that need to display or select standards
 * - Search by ISO/DIN designation or description
 * - Images referenced here should be placed in /static/images/standards/
 */

/**
 * Hardware type categorization - simplified like McMaster-Carr
 */
export enum HardwareType {
	SCREW = 'screw', // Socket head, countersunk, pan head, etc. (metric thread) - requires length
	BOLT = 'bolt', // Hex head, carriage, etc. (metric thread) - requires length
	WOOD_SCREW = 'wood_screw', // Wood screws (self-tapping thread, no pitch) - requires length
	NUT = 'nut', // Hex, lock, wing, etc. - NO length
	WASHER = 'washer', // Flat, spring, lock, etc. - NO length
	PIN = 'pin', // Dowel, cotter, spring pins, etc. - requires length
	RING = 'ring', // Retaining rings, snap rings, circlips, etc. - NO length
	RIVET = 'rivet', // Blind, solid, etc. - requires length
	OTHER = 'other' // Everything else - requires length by default
}

/**
 * Interface defining the structure of an ISO/DIN standard
 */
export interface ISODINStandard {
	/** Unique identifier for the standard */
	id: string;

	/** Primary standard system (ISO or DIN) */
	primarySystem: 'ISO' | 'DIN';

	/** Human-readable description of the standard */
	description: string;

	/** All standard designations (ISO, DIN, ANSI/ASME, PN, etc.) */
	designations: Array<{
		system: 'ISO' | 'DIN' | 'ANSI' | 'ASME' | 'PN' | 'GB' | 'JIS';
		code: string;
	}>;

	/** Hardware type for categorization */
	hardwareType?: HardwareType;

	/** Path to visual representation (relative to /static/) */
	image?: string;

	/** ICS (International Classification for Standards) codes */
	icsCode?: string[];

	/** ISO reference (e.g., "ISO 4762:2004") */
	reference?: string;

	/** Brief scope description */
	scope?: string;
}

/**
 * Import generated standards
 */
import { generatedStandards } from './standards-generated';

/**
 * Main standards array - generated from build pipeline
 */
export const standards = generatedStandards;

/**
 * Default standard to use when none is selected
 */
export const DEFAULT_STANDARD_ID = 'iso4762';

/**
 * Get a standard by its unique ID
 * @param id - The standard ID (e.g., "iso4762")
 * @returns The standard or undefined if not found
 */
export function getStandardById(id: string): ISODINStandard | undefined {
	const normalizedId = id.toLowerCase().trim();
	if (!normalizedId) {
		return undefined;
	}
	return standards.find((s) => s.id.toLowerCase() === normalizedId);
}

/**
 * Helper functions for search relevance scoring
 * These reduce cognitive complexity of the main sort function
 */

function hasExactCodeMatch(std: ISODINStandard, query: string): boolean {
	return std.designations.some((d) => d.code.toLowerCase() === query);
}

function hasExactFullMatch(std: ISODINStandard, query: string): boolean {
	return std.designations.some((d) => `${d.system} ${d.code}`.toLowerCase() === query);
}

function codeStartsWith(std: ISODINStandard, query: string): boolean {
	return std.designations.some((d) => d.code.toLowerCase().startsWith(query));
}

function fullDesignationStartsWith(std: ISODINStandard, query: string): boolean {
	return std.designations.some((d) => `${d.system} ${d.code}`.toLowerCase().startsWith(query));
}

function matchesPrimarySystem(std: ISODINStandard, query: string): boolean {
	return std.designations.some(
		(d) => d.system === std.primarySystem && d.code.toLowerCase().includes(query)
	);
}

/**
 * Search for standards by any designation code or description
 * @param query - The search query (can be ISO, DIN, ANSI, PN code or description)
 * @returns Array of matching standards, sorted by relevance
 */
export function searchStandards(query: string): ISODINStandard[] {
	const normalizedQuery = query.toLowerCase().trim();

	const results = standards.filter((std) => {
		// Search in all designation codes
		const matchesDesignation = std.designations.some((des) =>
			des.code.toLowerCase().includes(normalizedQuery)
		);

		// Search in description
		const matchesDescription = std.description.toLowerCase().includes(normalizedQuery);

		// Search in the combined designation string (e.g., "ISO 4762", "DIN 912")
		const matchesFullDesignation = std.designations.some((des) =>
			`${des.system} ${des.code}`.toLowerCase().includes(normalizedQuery)
		);

		return matchesDesignation || matchesDescription || matchesFullDesignation;
	});

	// Sort by relevance (most relevant first)
	return results.sort((a, b) => {
		// 1. Exact code match (highest priority)
		const aExactCode = hasExactCodeMatch(a, normalizedQuery);
		const bExactCode = hasExactCodeMatch(b, normalizedQuery);
		if (aExactCode !== bExactCode) return aExactCode ? -1 : 1;

		// 2. Exact full designation match (e.g., "din 912")
		const aExactFull = hasExactFullMatch(a, normalizedQuery);
		const bExactFull = hasExactFullMatch(b, normalizedQuery);
		if (aExactFull !== bExactFull) return aExactFull ? -1 : 1;

		// 3. Code starts with query
		const aStartsWith = codeStartsWith(a, normalizedQuery);
		const bStartsWith = codeStartsWith(b, normalizedQuery);
		if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;

		// 4. Full designation starts with query (e.g., "din" matches "DIN 912")
		const aFullStartsWith = fullDesignationStartsWith(a, normalizedQuery);
		const bFullStartsWith = fullDesignationStartsWith(b, normalizedQuery);
		if (aFullStartsWith !== bFullStartsWith) return aFullStartsWith ? -1 : 1;

		// 5. Primary system match (prefer matching primary system)
		const aMatchesPrimary = matchesPrimarySystem(a, normalizedQuery);
		const bMatchesPrimary = matchesPrimarySystem(b, normalizedQuery);
		if (aMatchesPrimary !== bMatchesPrimary) return aMatchesPrimary ? -1 : 1;

		// 6. Has image (prefer standards with images)
		const aHasImage = !!a.image;
		const bHasImage = !!b.image;
		if (aHasImage !== bHasImage) return aHasImage ? -1 : 1;

		// 7. Keep original order for equal relevance
		return 0;
	});
}

/**
 * Get a formatted string of all designations for a standard
 * @param standard - The standard to format
 * @returns Formatted string like "ISO 4762 / DIN 912 / ANSI B18.3"
 */
export function formatDesignations(standard: ISODINStandard): string {
	return standard.designations.map((d) => `${d.system} ${d.code}`).join(' / ');
}

/**
 * Get a formatted string of only the primary designation for a standard
 * @param standard - The standard to format
 * @returns Formatted string like "ISO 4762" or "DIN 912" based on primarySystem
 */
export function formatPrimaryDesignation(standard: ISODINStandard): string {
	// Find the designation matching the primary system
	const primaryDesignation = standard.designations.find((d) => d.system === standard.primarySystem);

	if (primaryDesignation) {
		return `${primaryDesignation.system} ${primaryDesignation.code}`;
	}

	// Fallback to first designation if primary not found
	if (standard.designations.length > 0) {
		return `${standard.designations[0].system} ${standard.designations[0].code}`;
	}

	return '';
}

/**
 * Check if length input should be disabled for a given hardware type
 * @param hardwareType - The hardware type to check
 * @returns True if length input should be disabled
 */
export function shouldDisableLength(hardwareType?: HardwareType): boolean {
	// Types that DON'T require length: NUT, WASHER, RING
	return (
		hardwareType === HardwareType.NUT ||
		hardwareType === HardwareType.WASHER ||
		hardwareType === HardwareType.RING
	);
}

/**
 * Check if pitch input should be disabled for a given hardware type
 * @param hardwareType - The hardware type to check
 * @returns True if pitch input should be disabled
 */
export function shouldDisablePitch(hardwareType?: HardwareType): boolean {
	// Washers have no threads, wood screws have self-tapping threads without metric pitch
	return hardwareType === HardwareType.WASHER || hardwareType === HardwareType.WOOD_SCREW;
}
