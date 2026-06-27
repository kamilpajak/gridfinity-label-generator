#!/usr/bin/env node

/**
 * Standards Build Script (v2)
 *
 * Builds the final TypeScript module from all data sources.
 * Part of pipeline: validate → resolve → fetch → build
 *
 * Data flow:
 * 1. Loads standards configuration v2 (iso, din sections)
 * 2. Loads DIN Media metadata cache (SSOT for descriptions)
 * 3. Loads image mappings (SSOT for images)
 * 4. Processes ISO standards from iso section
 * 5. Processes DIN standards from din section
 * 6. Generates final TypeScript module
 *
 * Usage:
 *   pnpm standards:build          # Normal build
 *   pnpm standards:build:strict   # Fail on unexpected withdrawn standards
 *
 * Options:
 *   --strict  Fail if any standard is withdrawn but not marked in config
 *
 * Input:
 *   data/standards-config.json - Standards list (iso, din sections)
 *   data/image-mappings.json - Image mappings
 *   data/dinmedia-id-mappings.json - Standard ID → DIN Media ID mappings
 *   data/dinmedia-metadata-cache.json - Cached metadata from DIN Media (SSOT)
 *
 * Output:
 *   src/lib/data/standards-generated.ts - TypeScript module with all standards
 *
 * @see docs/plan-standards-config-migration.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getHardwareType } from './hardware-type-mappings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI arguments
const STRICT_MODE = process.argv.includes('--strict');

// DIN Media integration files (Single Source of Truth for both DIN and ISO)
const DINMEDIA_MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'dinmedia-id-mappings.json');
const DINMEDIA_CACHE_FILE = path.join(__dirname, '..', 'data', 'dinmedia-metadata-cache.json');

/**
 * Load DIN Media data (mappings and metadata cache)
 * @returns {Object} { mappings, cache } or null if not available
 */
function loadDinMediaData() {
	try {
		const mappings = JSON.parse(fs.readFileSync(DINMEDIA_MAPPINGS_FILE, 'utf8'));
		const cache = JSON.parse(fs.readFileSync(DINMEDIA_CACHE_FILE, 'utf8'));
		return { mappings, cache };
	} catch {
		return null;
	}
}

/**
 * Get description from DIN Media cache for a standard
 * @param {string} standardId - Standard ID (e.g., 'iso4762', 'din912')
 * @param {Object} dinMediaData - { mappings, cache } from loadDinMediaData
 * @param {string} fallbackDescription - Fallback description if not found
 * @returns {string} Description from DIN Media or fallback
 */
function getDinMediaDescription(standardId, dinMediaData, fallbackDescription) {
	if (!dinMediaData) return fallbackDescription;

	// Normalize ID (remove variant suffix for lookup)
	const baseId = standardId.replace(/[a-z]$/i, '').toLowerCase();

	const mapping = dinMediaData.mappings[baseId] || dinMediaData.mappings[standardId];
	if (!mapping) return fallbackDescription;

	const metadata = dinMediaData.cache[mapping.dinMediaId];
	if (!metadata || !metadata.titleEn) return fallbackDescription;

	return metadata.titleEn;
}

/**
 * Check if a standard is withdrawn according to DIN Media cache
 * @param {string} standardId - Standard ID
 * @param {Object} dinMediaData - { mappings, cache } from loadDinMediaData
 * @returns {boolean} True if withdrawn
 */
function isWithdrawnInDinMedia(standardId, dinMediaData) {
	if (!dinMediaData) return false;

	const baseId = standardId.replace(/[a-z]$/i, '').toLowerCase();
	const mapping = dinMediaData.mappings[baseId] || dinMediaData.mappings[standardId];
	if (!mapping) return false;

	const metadata = dinMediaData.cache[mapping.dinMediaId];
	return metadata?.status === 'WITHDRAWN';
}

/**
 * Check if a standard is marked as withdrawn in config v2
 * @param {Object} configEntry - Entry from standards-config.json
 * @returns {boolean} True if withdrawn: true
 */
function isWithdrawnInConfig(configEntry) {
	return configEntry?.withdrawn === true;
}

/**
 * Check if a standard has a DIN Media mapping
 * Standards without mappings cannot be validated for withdrawn status
 * @param {string} standardId - Standard ID
 * @param {Object} dinMediaData - { mappings, cache } from loadDinMediaData
 * @returns {boolean} True if mapping exists
 */
function hasDinMediaMapping(standardId, dinMediaData) {
	if (!dinMediaData) return false;

	const baseId = standardId.replace(/[a-z]$/i, '').toLowerCase();
	return !!(dinMediaData.mappings[baseId] || dinMediaData.mappings[standardId]);
}

/**
 * Check if an image file exists in the static directory
 * @param {string} imagePath - Path like "/images/standards/din_965.png"
 * @returns {boolean} True if file exists
 */
function imageFileExists(imagePath) {
	const filePath = path.join(__dirname, '..', 'static', imagePath);
	return fs.existsSync(filePath);
}

/**
 * Find an image file for a standard by checking all designation systems
 * @param {Array} designations - Array of {system, code} objects
 * @returns {string|null} Image path if found, null otherwise
 */
function findImageForStandard(designations) {
	// Try each designation system in order
	for (const designation of designations) {
		const system = designation.system.toLowerCase();
		const code = designation.code.toLowerCase();
		const imagePath = `/images/standards/${system}_${code}.png`;

		if (imageFileExists(imagePath)) {
			return imagePath;
		}
	}

	return null;
}

/**
 * Add designation system codes to designations array
 * @param {Array} designations - Array of designation objects to append to
 * @param {Object} entry - Entry from config v2
 * @param {string} systemName - System name (e.g., 'DIN', 'ANSI', 'PN')
 */
function addDesignationSystem(designations, entry, systemName) {
	const systemKey = systemName.toLowerCase();
	if (!entry[systemKey]) return;

	const codes = Array.isArray(entry[systemKey]) ? entry[systemKey] : [entry[systemKey]];

	codes.forEach((code) => {
		designations.push({ system: systemName, code: String(code) });
	});
}

/**
 * Find and add image and hardwareType to standard object
 * @param {Object} standard - Standard object to add image to
 * @param {string} standardId - Standard ID for lookup in mappings
 * @param {Object} imageMappings - Image mappings (can be string or {image, hardwareType})
 * @param {Array} designations - Designations array for auto-detection
 */
function addImageToStandard(standard, standardId, imageMappings, designations) {
	if (imageMappings[standardId]) {
		const mapping = imageMappings[standardId];
		// Handle both old format (string) and new format ({image, hardwareType})
		if (typeof mapping === 'string') {
			standard.image = mapping;
		} else if (mapping.image) {
			standard.image = mapping.image;
			// Prefer hardwareType from image mappings (more accurate than heuristics)
			if (mapping.hardwareType && !standard.hardwareType) {
				standard.hardwareType = mapping.hardwareType;
			}
		}
	} else {
		const foundImage = findImageForStandard(designations);
		if (foundImage) {
			standard.image = foundImage;
		}
	}
}

/**
 * Main build orchestration function
 *
 * Orchestrates the entire build process:
 * 1. Loads configuration v2 and mapping files
 * 2. Processes ISO standards from iso section
 * 3. Processes DIN standards from din section
 * 4. Enriches with DIN Media descriptions (SSOT)
 * 5. Adds images from image mappings
 * 6. Determines hardware types
 * 7. Generates TypeScript output file
 */
async function buildStandards() {
	// Input files
	const configFile = path.join(__dirname, '..', 'data', 'standards-config.json');
	const imageMappingsFile = path.join(__dirname, '..', 'data', 'image-mappings.json');
	const outputFile = path.join(__dirname, '..', 'src', 'lib', 'data', 'standards-generated.ts');

	// Show mode
	if (STRICT_MODE) {
		console.log('🔒 Running in STRICT mode - will fail on unexpected withdrawn standards\n');
	}

	// Load configuration v2
	const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
	const isoCount = Object.keys(config.iso || {}).length;
	const dinCount = Object.keys(config.din || {}).length;
	console.log(`📋 Loaded config v2: ${isoCount} ISO standards, ${dinCount} DIN standards`);

	// Load image mappings (single source of truth for image mappings)
	let imageMappings = {};
	try {
		imageMappings = JSON.parse(fs.readFileSync(imageMappingsFile, 'utf8'));
		console.log(`🖼️  Loaded ${Object.keys(imageMappings).length} image mappings`);
	} catch {
		console.log('🖼️  No image mappings found, continuing without them');
	}

	// Load DIN Media data (Single Source of Truth for both DIN and ISO standards)
	const dinMediaData = loadDinMediaData();
	if (dinMediaData) {
		const mappingCount = Object.keys(dinMediaData.mappings).length;
		const cacheCount = Object.keys(dinMediaData.cache).length - 1; // -1 for _meta
		console.log(
			`🏛️  Loaded DIN Media data: ${mappingCount} mappings, ${cacheCount} cached metadata`
		);
	} else {
		console.log('🏛️  No DIN Media data found, using fallback descriptions');
		if (STRICT_MODE) {
			console.error('\n❌ STRICT mode requires DIN Media data!');
			console.error('   Run: pnpm standards:fetch first\n');
			process.exit(1);
		}
	}

	// Process ISO standards from iso section
	console.log('\n📚 Processing ISO standards...');
	const acknowledgedWithdrawnISO = []; // Marked as withdrawn in config
	const unexpectedWithdrawnISO = []; // WITHDRAWN in DIN Media but not marked in config
	const unmappedISO = [];

	const processedISO = Object.entries(config.iso || {}).map(([number, entry]) => {
		const id = `iso${number}`;

		// Build designations array
		const designations = [{ system: 'ISO', code: number }];

		// Add cross-referenced systems
		addDesignationSystem(designations, entry, 'DIN');
		addDesignationSystem(designations, entry, 'ANSI');
		addDesignationSystem(designations, entry, 'PN');

		// Check withdrawn status
		const markedWithdrawn = isWithdrawnInConfig(entry);
		const dinMediaWithdrawn = isWithdrawnInDinMedia(id, dinMediaData);

		if (markedWithdrawn) {
			acknowledgedWithdrawnISO.push(id);
		} else if (dinMediaWithdrawn) {
			unexpectedWithdrawnISO.push(id);
		}

		// Track unmapped ISO standards (cannot be validated)
		if (!hasDinMediaMapping(id, dinMediaData)) {
			unmappedISO.push(id);
		}

		// Build standard object
		// Prefer DIN as primarySystem if DIN designation exists
		const hasDIN = designations.some((d) => d.system === 'DIN');
		// Get description from DIN Media (SSOT) or fallback
		const fallbackDescription = `ISO ${number}`;
		const description = getDinMediaDescription(id, dinMediaData, fallbackDescription);
		const standard = {
			id,
			primarySystem: hasDIN ? 'DIN' : 'ISO',
			description,
			designations,
			hardwareType: getHardwareType(designations, description)
		};

		// Add image
		addImageToStandard(standard, id, imageMappings, designations);

		return standard;
	});

	console.log(`   Found ${processedISO.length} ISO standards`);
	if (acknowledgedWithdrawnISO.length > 0) {
		console.log(
			`   ℹ️  ${acknowledgedWithdrawnISO.length} acknowledged withdrawn (marked in config)`
		);
	}
	if (unexpectedWithdrawnISO.length > 0) {
		console.log(
			`   ⚠️  ${unexpectedWithdrawnISO.length} unexpected withdrawn: ${unexpectedWithdrawnISO.join(', ')}`
		);
	}
	if (unmappedISO.length > 0) {
		console.log(
			`   ⚠️  ${unmappedISO.length} ISO standard(s) without DIN Media mapping (cannot validate): ${unmappedISO.slice(0, 10).join(', ')}${unmappedISO.length > 10 ? '...' : ''}`
		);
	}

	// STRICT MODE: Only fail on UNEXPECTED withdrawn standards (not marked in config)
	if (STRICT_MODE && unexpectedWithdrawnISO.length > 0) {
		console.log('\n❌ STRICT MODE VALIDATION FAILED!\n');
		console.log('   Unexpected withdrawn ISO standards found:\n');
		for (const id of unexpectedWithdrawnISO) {
			console.log(`   • ${id}: WITHDRAWN in DIN Media but not marked in config`);
		}
		console.log('\n   Add "withdrawn": true to these entries in standards-config.json.\n');
		process.exit(1);
	}

	// Process DIN standards from din section
	console.log('🔩 Processing DIN standards...');
	const acknowledgedWithdrawnDIN = []; // Marked as withdrawn in config
	const unexpectedWithdrawnDIN = []; // WITHDRAWN in DIN Media but not marked in config

	const dinStandards = Object.entries(config.din || {}).map(([number, entry]) => {
		const id = `din${number}`;
		const designations = [{ system: 'DIN', code: number }];

		// Check withdrawn status
		const markedWithdrawn = isWithdrawnInConfig(entry);
		const dinMediaWithdrawn = isWithdrawnInDinMedia(id, dinMediaData);

		if (markedWithdrawn) {
			acknowledgedWithdrawnDIN.push(id);
		} else if (dinMediaWithdrawn) {
			unexpectedWithdrawnDIN.push(id);
		}

		// Get description from DIN Media (SSOT) or fallback
		const fallbackDescription = `DIN ${number}`;
		const description = getDinMediaDescription(id, dinMediaData, fallbackDescription);

		const standard = {
			id,
			primarySystem: 'DIN',
			description,
			designations,
			hardwareType: getHardwareType(designations, description)
		};

		// Add image
		addImageToStandard(standard, id, imageMappings, designations);

		return standard;
	});

	console.log(`   Found ${dinStandards.length} DIN standards`);
	if (acknowledgedWithdrawnDIN.length > 0) {
		console.log(
			`   ℹ️  ${acknowledgedWithdrawnDIN.length} acknowledged withdrawn (marked in config)`
		);
	}
	if (unexpectedWithdrawnDIN.length > 0) {
		console.log(
			`   ⚠️  ${unexpectedWithdrawnDIN.length} unexpected withdrawn: ${unexpectedWithdrawnDIN.slice(0, 10).join(', ')}${unexpectedWithdrawnDIN.length > 10 ? '...' : ''}`
		);
	}

	// STRICT MODE: Only fail on UNEXPECTED withdrawn standards
	if (STRICT_MODE && unexpectedWithdrawnDIN.length > 0) {
		console.log('\n❌ STRICT MODE VALIDATION FAILED!\n');
		console.log('   Unexpected withdrawn DIN standards found:\n');
		for (const id of unexpectedWithdrawnDIN) {
			console.log(`   • ${id}: WITHDRAWN in DIN Media but not marked in config`);
		}
		console.log('\n   Add "withdrawn": true to these entries in standards-config.json.\n');
		process.exit(1);
	}

	// STRICT MODE: Summary
	if (STRICT_MODE) {
		const totalWithdrawn = acknowledgedWithdrawnISO.length + acknowledgedWithdrawnDIN.length;
		const totalMapped = processedISO.length - unmappedISO.length + dinStandards.length;
		console.log(`\n   ✅ STRICT: All ${totalMapped} mapped standards validated`);
		if (totalWithdrawn > 0) {
			console.log(`   ℹ️  ${totalWithdrawn} standards marked as withdrawn (acknowledged)`);
		}
		if (unmappedISO.length > 0) {
			console.log(
				`   ⚠️  ${unmappedISO.length} ISO standards without DIN Media mapping - cannot validate`
			);
		}
	}

	// Combine all standards
	const allStandards = [...processedISO, ...dinStandards];

	// Sort standards
	const sortedStandards = allStandards.sort((a, b) => {
		// First sort by primary system (ISO before DIN)
		if (a.primarySystem !== b.primarySystem) {
			return a.primarySystem === 'ISO' ? -1 : 1;
		}

		// Then sort by number within each system
		const aCode = a.designations[0].code;
		const bCode = b.designations[0].code;
		const aNum = parseInt(aCode);
		const bNum = parseInt(bCode);
		return aNum - bNum;
	});

	// Count standards with images
	const standardsWithImages = sortedStandards.filter((s) => s.image).length;

	// Generate TypeScript file
	const tsContent = `/**
 * GENERATED FILE - DO NOT EDIT
 *
 * This file is automatically generated by scripts/standards-build.js
 * To update, modify the source data and run: pnpm standards:build
 *
 * Generated: ${new Date().toISOString()}
 * Total standards: ${sortedStandards.length}
 * ISO standards: ${processedISO.length}
 * DIN standards: ${dinStandards.length}
 * Standards with images: ${standardsWithImages}
 */

import type { ISODINStandard, HardwareType } from './standards';

/**
 * Generated list of fastener standards with cross-references
 */
export const generatedStandards: ISODINStandard[] = ${JSON.stringify(sortedStandards, null, 2)
		.replace(/"system":/g, 'system:')
		.replace(/"code":/g, 'code:')
		.replace(/"id":/g, 'id:')
		.replace(/"primarySystem":/g, 'primarySystem:')
		.replace(/"description":/g, 'description:')
		.replace(/"designations":/g, 'designations:')
		.replace(/"hardwareType":/g, 'hardwareType:')
		.replace(/"icsCode":/g, 'icsCode:')
		.replace(/"reference":/g, 'reference:')
		.replace(/"scope":/g, 'scope:')
		.replace(/"image":/g, 'image:')
		.replace(/"(ISO|DIN|ANSI|PN)":/g, '$1:')
		.replace(/hardwareType: "(\w+)"/g, 'hardwareType: "$1" as HardwareType')} as const;
`;

	// Write output file
	fs.writeFileSync(outputFile, tsContent);

	console.log(`\n✅ Build complete!`);
	console.log(`   Total standards: ${sortedStandards.length}`);
	console.log(`   ISO standards: ${processedISO.length}`);
	console.log(`   DIN standards: ${dinStandards.length}`);
	console.log(`   Standards with images: ${standardsWithImages}`);
	console.log(`   Output: ${outputFile}`);
}

// Run the build
buildStandards().catch(console.error);
