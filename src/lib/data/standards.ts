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
 * Search for standards by any designation code or description
 * @param query - The search query (can be ISO, DIN, ANSI, PN code or description)
 * @returns Array of matching standards
 */
export function searchStandards(query: string): ISODINStandard[] {
	const normalizedQuery = query.toLowerCase().trim();

	return standards.filter((std) => {
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
	const primaryDesignation = standard.designations.find(
		(d) => d.system === standard.primarySystem
	);

	if (primaryDesignation) {
		return `${primaryDesignation.system} ${primaryDesignation.code}`;
	}

	// Fallback to first designation if primary not found
	if (standard.designations.length > 0) {
		return `${standard.designations[0].system} ${standard.designations[0].code}`;
	}

	return '';
}
