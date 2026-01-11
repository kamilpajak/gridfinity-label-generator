/**
 * Standards Config Validator
 *
 * Validates the structure and content of standards-config.json.
 * Part of Phase 2 of the standards validation pipeline.
 *
 * @see docs/plan-standards-validation-pipeline.md
 */

/**
 * Result of a validation operation
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Expected structure of a crossref entry
 */
interface CrossrefEntry {
	din: string[];
	[key: string]: unknown;
}

/**
 * Expected structure of a dinOnly entry
 */
interface DinOnlyEntry {
	description: string;
	[key: string]: unknown;
}

/**
 * Expected structure of standards-config.json
 */
export interface StandardsConfig {
	crossref: Record<string, CrossrefEntry>;
	dinOnly: Record<string, DinOnlyEntry>;
}

/**
 * Validate the overall structure of the config
 */
export function validateConfigStructure(config: unknown): ValidationResult {
	const errors: string[] = [];

	if (typeof config !== 'object' || config === null) {
		return { valid: false, errors: ['Config must be an object'] };
	}

	const cfg = config as Record<string, unknown>;

	// Check required sections
	if (!('crossref' in cfg)) {
		errors.push('Missing required section: crossref');
	} else if (
		typeof cfg.crossref !== 'object' ||
		cfg.crossref === null ||
		Array.isArray(cfg.crossref)
	) {
		errors.push('crossref must be an object');
	}

	if (!('dinOnly' in cfg)) {
		errors.push('Missing required section: dinOnly');
	} else if (
		typeof cfg.dinOnly !== 'object' ||
		cfg.dinOnly === null ||
		Array.isArray(cfg.dinOnly)
	) {
		errors.push('dinOnly must be an object');
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate ID format (must be iso#### or din####)
 */
export function validateIdFormat(id: string): ValidationResult {
	const errors: string[] = [];

	if (!id || typeof id !== 'string') {
		errors.push('Invalid ID format: ID must be a non-empty string');
		return { valid: false, errors };
	}

	// ID must be lowercase iso or din followed by numbers only
	const validPattern = /^(iso|din)\d+$/;

	if (!validPattern.test(id)) {
		errors.push(`Invalid ID format: "${id}" must match pattern (iso|din) followed by numbers`);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Check for duplicate IDs between crossref and dinOnly sections
 */
export function validateNoDuplicates(config: StandardsConfig): ValidationResult {
	const errors: string[] = [];

	const crossrefIds = Object.keys(config.crossref || {});
	const dinOnlyIds = Object.keys(config.dinOnly || {});

	// Find IDs that appear in both sections
	const duplicates = crossrefIds.filter((id) => dinOnlyIds.includes(id));

	for (const dup of duplicates) {
		errors.push(`Duplicate ID "${dup}" found in both crossref and dinOnly sections`);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate cross-reference entries have valid structure
 */
export function validateCrossReferences(config: StandardsConfig): ValidationResult {
	const errors: string[] = [];

	const crossref = config.crossref || {};

	for (const [id, entry] of Object.entries(crossref)) {
		// Check din property exists
		if (!('din' in entry)) {
			errors.push(`Crossref entry "${id}" is missing din property`);
			continue;
		}

		// Check din is an array
		if (!Array.isArray(entry.din)) {
			errors.push(`Crossref entry "${id}": din must be an array`);
			continue;
		}

		// Check each DIN code is a valid number string
		for (const dinCode of entry.din) {
			if (typeof dinCode !== 'string' || !/^\d+$/.test(dinCode)) {
				errors.push(
					`Crossref entry "${id}": Invalid DIN code "${dinCode}" (must be numeric string)`
				);
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Run all validations on the config
 */
export function validateConfig(config: unknown): ValidationResult {
	const allErrors: string[] = [];

	// Step 1: Validate structure
	const structureResult = validateConfigStructure(config);
	allErrors.push(...structureResult.errors);

	// If structure is invalid, we can't proceed with other validations
	if (!structureResult.valid) {
		return { valid: false, errors: allErrors };
	}

	const cfg = config as StandardsConfig;

	// Step 2: Validate all ID formats
	const allIds = [...Object.keys(cfg.crossref || {}), ...Object.keys(cfg.dinOnly || {})];
	for (const id of allIds) {
		const idResult = validateIdFormat(id);
		allErrors.push(...idResult.errors);
	}

	// Step 3: Check for duplicates
	const duplicatesResult = validateNoDuplicates(cfg);
	allErrors.push(...duplicatesResult.errors);

	// Step 4: Validate cross-references
	const crossrefResult = validateCrossReferences(cfg);
	allErrors.push(...crossrefResult.errors);

	return { valid: allErrors.length === 0, errors: allErrors };
}
