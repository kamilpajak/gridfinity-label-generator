#!/usr/bin/env node
/**
 * Standards Validate Script (v2)
 *
 * Validates the structure and content of standards-config.json v2.
 * Part of pipeline: validate → resolve → fetch → build
 *
 * V2 structure uses per-system sections (iso, din, etc.) instead of
 * crossref/dinOnly sections.
 *
 * Checks:
 * - JSON structure (iso, din, ansi, pn, gb, jis sections)
 * - Standard number format (digits with optional letter suffix)
 * - Cross-reference consistency (arrays of numeric strings)
 * - Withdrawn field (boolean)
 * - ReplacedBy references exist
 *
 * Usage:
 *   pnpm standards:validate
 *   node scripts/standards-validate.js
 *   node scripts/standards-validate.js --config="path/to/config.json"
 *
 * Exit codes:
 *   0 - Validation passed
 *   1 - Validation failed
 *
 * @see docs/plan-standards-config-migration.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
const args = process.argv.slice(2);
const configArg = args.find((arg) => arg.startsWith('--config='));
const CONFIG_FILE = configArg
	? configArg.replace('--config=', '').replace(/"/g, '')
	: path.join(__dirname, '..', 'data', 'standards-config.json');

/**
 * Valid standard systems
 * NOTE: Keep in sync with src/lib/utils/standards-config.ts
 */
const VALID_SYSTEMS = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];

/**
 * Cross-reference systems (systems that can appear as cross-ref keys)
 */
const CROSSREF_SYSTEMS = ['din', 'iso', 'ansi', 'pn', 'gb', 'jis'];

/**
 * Pattern for valid standard numbers
 */
const STANDARD_NUMBER_PATTERN = /^\d+[a-z]?$/;

/**
 * Pattern for valid full standard ID (for replacedBy)
 */
const FULL_ID_PATTERN = /^(iso|din|ansi|pn|gb|jis)\d+[a-z]?$/;

/**
 * Validate config structure
 * @param {unknown} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateConfigStructure(config) {
	const errors = [];
	const warnings = [];

	if (typeof config !== 'object' || config === null || Array.isArray(config)) {
		return { valid: false, errors: ['Config must be an object'], warnings: [] };
	}

	const keys = Object.keys(config);

	// Check for at least one valid system section
	const validSystemKeys = keys.filter((k) => VALID_SYSTEMS.includes(k));
	if (validSystemKeys.length === 0) {
		errors.push('Config must have at least one system section (iso, din, ansi, pn, gb, jis)');
	}

	// Warn about unknown top-level keys
	const unknownKeys = keys.filter((k) => !VALID_SYSTEMS.includes(k));
	for (const key of unknownKeys) {
		warnings.push(`Unknown top-level key: "${key}"`);
	}

	// Validate each system section is an object
	for (const system of validSystemKeys) {
		const section = config[system];
		if (typeof section !== 'object' || section === null || Array.isArray(section)) {
			errors.push(`Section "${system}" must be an object`);
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate standard number format
 * @param {string} number
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateStandardNumber(number) {
	const errors = [];

	if (!number || typeof number !== 'string') {
		errors.push('Invalid standard number: must be a non-empty string');
		return { valid: false, errors };
	}

	if (!STANDARD_NUMBER_PATTERN.test(number)) {
		errors.push(`Invalid standard number: "${number}" must be digits with optional letter suffix`);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate a system section
 * @param {string} system
 * @param {object} section
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSystemSection(system, section) {
	const errors = [];

	for (const [number, entry] of Object.entries(section)) {
		// Validate standard number format
		const numberResult = validateStandardNumber(number);
		if (!numberResult.valid) {
			errors.push(`${system}.${number}: ${numberResult.errors[0]}`);
			continue;
		}

		// Validate entry is an object
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
			errors.push(`${system}.${number}: Entry must be an object`);
			continue;
		}

		// Validate cross-reference arrays
		for (const crossRefSystem of CROSSREF_SYSTEMS) {
			if (crossRefSystem in entry) {
				const crossRefs = entry[crossRefSystem];

				if (!Array.isArray(crossRefs)) {
					errors.push(`${system}.${number}.${crossRefSystem}: must be an array`);
					continue;
				}

				// Validate each cross-ref code is numeric string
				for (const code of crossRefs) {
					if (typeof code !== 'string' || !/^\d+$/.test(code)) {
						errors.push(
							`${system}.${number}.${crossRefSystem}: Invalid cross-ref code "${code}" (must be numeric string)`
						);
					}
				}
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate withdrawn fields
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateWithdrawnFields(config) {
	const errors = [];
	const warnings = [];

	// Build set of all valid standard IDs
	const allIds = new Set();
	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (section) {
			for (const number of Object.keys(section)) {
				allIds.add(`${system}${number}`);
			}
		}
	}

	// Validate each entry
	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (!section) continue;

		for (const [number, entry] of Object.entries(section)) {
			const fullId = `${system}${number}`;

			// Validate withdrawn field
			if ('withdrawn' in entry && entry.withdrawn !== undefined) {
				if (typeof entry.withdrawn !== 'boolean') {
					errors.push(`${fullId}: "withdrawn" must be a boolean`);
				}
			}

			// Validate replacedBy field
			if ('replacedBy' in entry && entry.replacedBy !== undefined) {
				const replacedBy = entry.replacedBy;

				// Check format
				if (!FULL_ID_PATTERN.test(replacedBy)) {
					errors.push(`${fullId}: Invalid replacedBy format "${replacedBy}"`);
				} else if (!allIds.has(replacedBy)) {
					errors.push(`${fullId}: replacedBy references non-existent standard "${replacedBy}"`);
				}
			}

			// Warn if withdrawn but no replacedBy
			if (entry.withdrawn === true && !entry.replacedBy) {
				warnings.push(`${fullId}: withdrawn with no replacement specified`);
			}
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Run all validations
 * @param {unknown} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateConfig(config) {
	const allErrors = [];
	const allWarnings = [];

	// Step 1: Validate structure
	const structureResult = validateConfigStructure(config);
	allErrors.push(...structureResult.errors);
	allWarnings.push(...structureResult.warnings);

	if (!structureResult.valid) {
		return { valid: false, errors: allErrors, warnings: allWarnings };
	}

	// Step 2: Validate each system section
	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (section) {
			const sectionResult = validateSystemSection(system, section);
			allErrors.push(...sectionResult.errors);
		}
	}

	// Step 3: Validate withdrawn fields
	const withdrawnResult = validateWithdrawnFields(config);
	allErrors.push(...withdrawnResult.errors);
	allWarnings.push(...withdrawnResult.warnings);

	return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}

/**
 * Main function
 */
function main() {
	console.log('='.repeat(60));
	console.log('Validate Standards Config (v2)');
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
	let totalCount = 0;
	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (section) {
			const count = Object.keys(section).length;
			if (count > 0) {
				console.log(`📋 ${system.toUpperCase()}: ${count} entries`);
				totalCount += count;
			}
		}
	}
	console.log(`   Total: ${totalCount} standards\n`);

	// Validate
	console.log('🔍 Running validation...\n');
	const result = validateConfig(config);

	// Show warnings
	if (result.warnings && result.warnings.length > 0) {
		console.log(`⚠️  ${result.warnings.length} warning(s):\n`);
		for (const warning of result.warnings.slice(0, 10)) {
			console.log(`   • ${warning}`);
		}
		if (result.warnings.length > 10) {
			console.log(`   ... and ${result.warnings.length - 10} more`);
		}
		console.log('');
	}

	if (result.valid) {
		console.log('✅ Validation PASSED\n');
		console.log('   - Structure: OK');
		console.log('   - Standard numbers: OK');
		console.log('   - Cross-references: OK');
		console.log('   - Withdrawn fields: OK');
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
