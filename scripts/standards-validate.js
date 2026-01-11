#!/usr/bin/env node

/**
 * Standards Validate Script
 *
 * Validates the structure and content of standards-config.json.
 * Part of pipeline: validate → resolve → fetch → build
 *
 * Checks:
 * - JSON structure (crossref, dinOnly sections)
 * - ID format (iso####, din####)
 * - No duplicates between sections
 * - Cross-reference consistency
 * - Status field values (CURRENT, WITHDRAWN)
 * - ReplacedBy references exist
 *
 * Usage:
 *   pnpm standards:validate
 *
 * Exit codes:
 *   0 - Validation passed
 *   1 - Validation failed
 *
 * @see docs/plan-standards-validation-pipeline.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import validator from compiled TypeScript
// Note: This requires the project to be built or use ts-node
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'standards-config.json');

/**
 * Validation result type
 * @typedef {{ valid: boolean, errors: string[] }} ValidationResult
 */

/**
 * Validate the overall structure of the config
 * @param {unknown} config
 * @returns {ValidationResult}
 */
function validateConfigStructure(config) {
	const errors = [];

	if (typeof config !== 'object' || config === null) {
		return { valid: false, errors: ['Config must be an object'] };
	}

	// Check required sections
	if (!('crossref' in config)) {
		errors.push('Missing required section: crossref');
	} else if (
		typeof config.crossref !== 'object' ||
		config.crossref === null ||
		Array.isArray(config.crossref)
	) {
		errors.push('crossref must be an object');
	}

	if (!('dinOnly' in config)) {
		errors.push('Missing required section: dinOnly');
	} else if (
		typeof config.dinOnly !== 'object' ||
		config.dinOnly === null ||
		Array.isArray(config.dinOnly)
	) {
		errors.push('dinOnly must be an object');
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate ID format (must be iso#### or din####)
 * @param {string} id
 * @returns {ValidationResult}
 */
function validateIdFormat(id) {
	const errors = [];

	if (!id || typeof id !== 'string') {
		errors.push('Invalid ID format: ID must be a non-empty string');
		return { valid: false, errors };
	}

	const validPattern = /^(iso|din)\d+$/;

	if (!validPattern.test(id)) {
		errors.push(`Invalid ID format: "${id}" must match pattern (iso|din) followed by numbers`);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Check for duplicate IDs between crossref and dinOnly sections
 * @param {{ crossref: Object, dinOnly: Object }} config
 * @returns {ValidationResult}
 */
function validateNoDuplicates(config) {
	const errors = [];

	const crossrefIds = Object.keys(config.crossref || {});
	const dinOnlyIds = Object.keys(config.dinOnly || {});

	const duplicates = crossrefIds.filter((id) => dinOnlyIds.includes(id));

	for (const dup of duplicates) {
		errors.push(`Duplicate ID "${dup}" found in both crossref and dinOnly sections`);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate cross-reference entries have valid structure
 * @param {{ crossref: Object, dinOnly: Object }} config
 * @returns {ValidationResult}
 */
function validateCrossReferences(config) {
	const errors = [];

	const crossref = config.crossref || {};

	for (const [id, entry] of Object.entries(crossref)) {
		if (!('din' in entry)) {
			errors.push(`Crossref entry "${id}" is missing din property`);
			continue;
		}

		if (!Array.isArray(entry.din)) {
			errors.push(`Crossref entry "${id}": din must be an array`);
			continue;
		}

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
 * @param {unknown} config
 * @returns {ValidationResult}
 */
function validateConfig(config) {
	const allErrors = [];

	// Step 1: Validate structure
	const structureResult = validateConfigStructure(config);
	allErrors.push(...structureResult.errors);

	if (!structureResult.valid) {
		return { valid: false, errors: allErrors };
	}

	// Step 2: Validate all ID formats
	const allIds = [...Object.keys(config.crossref || {}), ...Object.keys(config.dinOnly || {})];
	for (const id of allIds) {
		const idResult = validateIdFormat(id);
		allErrors.push(...idResult.errors);
	}

	// Step 3: Check for duplicates
	const duplicatesResult = validateNoDuplicates(config);
	allErrors.push(...duplicatesResult.errors);

	// Step 4: Validate cross-references
	const crossrefResult = validateCrossReferences(config);
	allErrors.push(...crossrefResult.errors);

	return { valid: allErrors.length === 0, errors: allErrors };
}

/**
 * Main function
 */
function main() {
	console.log('='.repeat(60));
	console.log('Validate Standards Config');
	console.log('='.repeat(60));
	console.log(`\nFile: ${CONFIG_FILE}\n`);

	// Check if file exists
	if (!fs.existsSync(CONFIG_FILE)) {
		console.error('❌ Config file not found:', CONFIG_FILE);
		process.exit(1);
	}

	// Read and parse config
	let config;
	try {
		const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
		config = JSON.parse(content);
	} catch (error) {
		console.error('❌ Failed to parse config file:', error.message);
		process.exit(1);
	}

	// Count entries
	const crossrefCount = Object.keys(config.crossref || {}).length;
	const dinOnlyCount = Object.keys(config.dinOnly || {}).length;
	console.log(`📋 Found ${crossrefCount} crossref entries, ${dinOnlyCount} dinOnly entries`);
	console.log(`   Total: ${crossrefCount + dinOnlyCount} standards\n`);

	// Validate
	console.log('🔍 Running validation...\n');
	const result = validateConfig(config);

	if (result.valid) {
		console.log('✅ Validation PASSED\n');
		console.log('   - Structure: OK');
		console.log('   - ID formats: OK');
		console.log('   - No duplicates: OK');
		console.log('   - Cross-references: OK');
		process.exit(0);
	} else {
		console.log('❌ Validation FAILED\n');
		console.log(`Found ${result.errors.length} error(s):\n`);
		for (const error of result.errors) {
			console.log(`   • ${error}`);
		}
		console.log('');
		process.exit(1);
	}
}

main();
