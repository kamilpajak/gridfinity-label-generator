/**
 * Standards Config Validator (v2)
 *
 * Validates the structure and content of standards-config.json v2.
 * V2 uses per-system sections (iso, din, etc.) instead of crossref/dinOnly.
 *
 * @see docs/plan-standards-config-migration.md
 */

import {
	parseStandardId,
	VALID_SYSTEMS,
	type StandardSystem,
	type StandardEntry,
	type StandardsConfigV2
} from './standards-config';

/**
 * Cross-reference systems (systems that can appear as cross-ref keys)
 * Uses VALID_SYSTEMS since all systems can be cross-referenced
 */
const CROSSREF_SYSTEMS: readonly string[] = VALID_SYSTEMS;

/**
 * Pattern for valid standard numbers (digits with optional letter suffix)
 */
const STANDARD_NUMBER_PATTERN = /^\d+[a-z]?$/;

/**
 * Result of a validation operation
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings?: string[];
}

/**
 * Re-export types from standards-config for backwards compatibility.
 * StandardEntry is the canonical type (StandardEntryV2 is an alias).
 */
export type { StandardEntry, StandardsConfigV2 };
export type StandardEntryV2 = StandardEntry;

/**
 * Validate the overall structure of the config
 */
export function validateConfigStructure(config: unknown): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (typeof config !== 'object' || config === null || Array.isArray(config)) {
		return { valid: false, errors: ['Config must be an object'] };
	}

	const cfg = config as Record<string, unknown>;
	const keys = Object.keys(cfg);

	// Check for at least one valid system section
	const validSystemKeys = keys.filter((k) => VALID_SYSTEMS.includes(k as StandardSystem));
	if (validSystemKeys.length === 0) {
		errors.push('Config must have at least one system section (iso, din, ansi, pn, gb, jis)');
	}

	// Warn about unknown top-level keys
	const unknownKeys = keys.filter((k) => !VALID_SYSTEMS.includes(k as StandardSystem));
	for (const key of unknownKeys) {
		warnings.push(`Unknown top-level key: "${key}" (expected: ${VALID_SYSTEMS.join(', ')})`);
	}

	// Validate each system section is an object
	for (const system of validSystemKeys) {
		const section = cfg[system];
		if (typeof section !== 'object' || section === null || Array.isArray(section)) {
			errors.push(`Section "${system}" must be an object`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Validate standard number format (digits with optional letter suffix)
 */
export function validateStandardNumber(number: string): ValidationResult {
	const errors: string[] = [];

	if (!number || typeof number !== 'string') {
		errors.push('Invalid standard number: must be a non-empty string');
		return { valid: false, errors };
	}

	if (!STANDARD_NUMBER_PATTERN.test(number)) {
		errors.push(
			`Invalid standard number: "${number}" must be digits with optional letter suffix (e.g., "4762", "7504k")`
		);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate a cross-reference array (helper to reduce cognitive complexity)
 */
function validateCrossRefArray(
	prefix: string,
	crossRefSystem: string,
	crossRefs: unknown
): string[] {
	const errors: string[] = [];

	if (!Array.isArray(crossRefs)) {
		errors.push(`${prefix}.${crossRefSystem}: must be an array`);
		return errors;
	}

	for (const code of crossRefs) {
		if (typeof code !== 'string' || !/^\d+$/.test(code)) {
			errors.push(
				`${prefix}.${crossRefSystem}: Invalid cross-ref code "${code}" (must be numeric string)`
			);
		}
	}

	return errors;
}

/**
 * Validate a single entry in a system section (helper to reduce cognitive complexity)
 */
function validateSectionEntry(system: string, number: string, entry: unknown): string[] {
	const errors: string[] = [];
	const prefix = `${system}.${number}`;

	// Validate standard number format
	const numberResult = validateStandardNumber(number);
	if (!numberResult.valid) {
		errors.push(`${prefix}: ${numberResult.errors[0]}`);
		return errors;
	}

	// Validate entry is an object
	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		errors.push(`${prefix}: Entry must be an object`);
		return errors;
	}

	const entryObj = entry as Record<string, unknown>;

	// Validate cross-reference arrays
	for (const crossRefSystem of CROSSREF_SYSTEMS) {
		if (crossRefSystem in entryObj) {
			errors.push(...validateCrossRefArray(prefix, crossRefSystem, entryObj[crossRefSystem]));
		}
	}

	return errors;
}

/**
 * Validate a single system section
 */
export function validateSystemSection(
	system: string,
	section: Record<string, unknown>
): ValidationResult {
	const errors: string[] = [];

	for (const [number, entry] of Object.entries(section)) {
		errors.push(...validateSectionEntry(system, number, entry));
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate no duplicate cross-references
 * (Currently just passes - cross-refs to unlisted standards are allowed)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateNoDuplicateCrossRefs(config: StandardsConfigV2): ValidationResult {
	// Cross-refs to standards not in config are allowed
	// This is just a placeholder for potential future validation
	return { valid: true, errors: [] };
}

/**
 * Build set of all standard IDs in config (helper to reduce cognitive complexity)
 */
function buildAllStandardIds(config: StandardsConfigV2): Set<string> {
	const allIds = new Set<string>();
	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (!section) continue;
		for (const number of Object.keys(section)) {
			allIds.add(`${system}${number}`);
		}
	}
	return allIds;
}

/**
 * Validate withdrawn/replacedBy for a single entry (helper to reduce cognitive complexity)
 */
function validateEntryWithdrawnStatus(
	fullId: string,
	entry: StandardEntry,
	allIds: Set<string>
): { errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate withdrawn field
	if ('withdrawn' in entry && entry.withdrawn !== undefined) {
		if (typeof entry.withdrawn !== 'boolean') {
			errors.push(`${fullId}: "withdrawn" must be a boolean`);
		}
	}

	// Validate replacedBy field
	if ('replacedBy' in entry && entry.replacedBy !== undefined) {
		const parsed = parseStandardId(entry.replacedBy);
		if (!parsed) {
			errors.push(`${fullId}: Invalid replacedBy format "${entry.replacedBy}"`);
		} else if (!allIds.has(entry.replacedBy)) {
			errors.push(`${fullId}: replacedBy references non-existent standard "${entry.replacedBy}"`);
		}
	}

	// Warn if withdrawn but no replacedBy
	if (entry.withdrawn === true && !entry.replacedBy) {
		warnings.push(`${fullId}: withdrawn with no replacement specified`);
	}

	return { errors, warnings };
}

/**
 * Validate withdrawn fields and replacedBy references
 */
export function validateWithdrawnFields(config: StandardsConfigV2): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const allIds = buildAllStandardIds(config);

	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (!section) continue;

		for (const [number, entry] of Object.entries(section)) {
			const result = validateEntryWithdrawnStatus(`${system}${number}`, entry, allIds);
			errors.push(...result.errors);
			warnings.push(...result.warnings);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Run all validations on the config
 */
export function validateConfig(config: unknown): ValidationResult {
	const allErrors: string[] = [];
	const allWarnings: string[] = [];

	// Step 1: Validate structure
	const structureResult = validateConfigStructure(config);
	allErrors.push(...structureResult.errors);
	if (structureResult.warnings) {
		allWarnings.push(...structureResult.warnings);
	}

	// If structure is invalid, we can't proceed with other validations
	if (!structureResult.valid) {
		return {
			valid: false,
			errors: allErrors,
			warnings: allWarnings.length > 0 ? allWarnings : undefined
		};
	}

	const cfg = config as StandardsConfigV2;

	// Step 2: Validate each system section
	for (const system of VALID_SYSTEMS) {
		const section = cfg[system];
		if (section) {
			const sectionResult = validateSystemSection(system, section as Record<string, unknown>);
			allErrors.push(...sectionResult.errors);
		}
	}

	// Step 3: Validate cross-references
	const crossRefResult = validateNoDuplicateCrossRefs(cfg);
	allErrors.push(...crossRefResult.errors);

	// Step 4: Validate withdrawn fields
	const withdrawnResult = validateWithdrawnFields(cfg);
	allErrors.push(...withdrawnResult.errors);
	if (withdrawnResult.warnings) {
		allWarnings.push(...withdrawnResult.warnings);
	}

	return {
		valid: allErrors.length === 0,
		errors: allErrors,
		warnings: allWarnings.length > 0 ? allWarnings : undefined
	};
}
