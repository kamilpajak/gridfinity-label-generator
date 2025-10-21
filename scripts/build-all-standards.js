#!/usr/bin/env node

/**
 * Unified Standards Builder
 *
 * This script processes all standards data in a single pipeline:
 * 1. Processes raw ISO data from JSONL
 * 2. Applies cross-references and mappings
 * 3. Includes DIN-only standards
 * 4. Generates final TypeScript module
 *
 * Purpose:
 * - Single script for entire build process
 * - No intermediate files needed
 * - Processes everything in memory
 *
 * Usage:
 *   pnpm build-standards
 *   # or
 *   node scripts/build-all-standards.js
 *
 * Input:
 *   data/raw/iso_deliverables_metadata.jsonl - Raw ISO standards data
 *   data/standards-config.json - All configurations (crossref, DIN-only, images)
 *
 * Output:
 *   src/lib/data/standards-generated.ts - TypeScript module with all standards
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { getHardwareType } from './hardware-type-mappings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Load all ISO data from JSONL (unfiltered, for validation)
 * @param {string} filePath - Path to JSONL file
 * @returns {Map} Map of isoId -> full ISO data
 */
async function loadAllISOData(filePath) {
	const isoDataMap = new Map();
	const fileStream = fs.createReadStream(filePath);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const data = JSON.parse(line);

			// Extract ISO number from reference
			const match = data.reference?.match(/ISO (\d+)/);
			if (!match) continue;

			const isoNumber = match[1];
			const id = `iso${isoNumber}`;

			// Keep the most recent version (last one wins)
			isoDataMap.set(id, data);
		} catch (error) {
			// Skip invalid JSONL lines (usually malformed JSON)
			// This is expected for some lines in the raw data
			if (process.env.DEBUG) {
				console.warn(`Skipped invalid line in loadAllISOData: ${error.message}`);
			}
		}
	}

	return isoDataMap;
}

// Process ISO data from JSONL
async function processISOData(filePath) {
	const standards = [];
	const seenIds = new Set(); // Track duplicates
	const fileStream = fs.createReadStream(filePath);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const data = JSON.parse(line);

			// Skip non-fastener standards
			if (!data.icsCode || !data.icsCode.some((code) => code.startsWith('21.060'))) {
				continue;
			}

			// Skip withdrawn standards (95+ codes)
			if (data.currentStage && data.currentStage >= 9500) {
				continue;
			}

			// Must be from TC 2 committee (fasteners)
			if (
				!data.ownerCommittee ||
				!(data.ownerCommittee === 'ISO/TC 2' || data.ownerCommittee.startsWith('ISO/TC 2/'))
			) {
				continue;
			}

			// Skip if replaced by another standard
			if (data.replacedBy && data.replacedBy.length > 0) {
				continue;
			}

			// Extract number from reference
			const match = data.reference.match(/ISO (\d+)/);
			if (!match) continue;

			const isoNumber = match[1];
			const id = `iso${isoNumber}`;

			// Skip duplicates (keep the first one)
			if (seenIds.has(id)) {
				continue;
			}
			seenIds.add(id);

			// Create standard object
			standards.push({
				id,
				primarySystem: 'ISO',
				reference: data.reference,
				title: data.title?.en || data.title?.fr || '',
				icsCode: data.icsCode,
				scope: data.abstract?.en || data.abstract?.fr || ''
			});
		} catch (error) {
			// Skip invalid JSONL lines (usually malformed JSON or missing fields)
			// This is expected for some lines in the raw data
			if (process.env.DEBUG) {
				console.warn(`Skipped invalid line in processISOData: ${error.message}`);
			}
		}
	}

	return standards;
}

/**
 * Validate standards configuration against ISO database
 * @param {Object} config - Configuration object from standards-config.json
 * @param {Map} isoDataMap - Map of isoId -> full ISO data
 * @returns {boolean} True if validation passes, exits process on errors
 */
function validateConfig(config, isoDataMap) {
	const errors = [];
	const warnings = [];

	console.log('\n🔍 Validating standards configuration...');

	// Validate crossref entries
	for (const [isoId] of Object.entries(config.crossref)) {
		const isoData = isoDataMap.get(isoId);

		// 1. Check ISO exists in database
		if (!isoData) {
			errors.push(`${isoId}: NOT FOUND in ISO database`);
			continue;
		}

		// 2. Check ICS code (must be fastener)
		if (!isoData.icsCode || !isoData.icsCode.some((code) => code.startsWith('21.060'))) {
			const icsDisplay = isoData.icsCode ? isoData.icsCode.join(', ') : 'none';
			errors.push(
				`${isoId}: Wrong category (ICS ${icsDisplay}), not fasteners (21.060.xx required)`
			);
		}

		// 3. Check committee (should be ISO/TC 2)
		if (
			isoData.ownerCommittee &&
			!(isoData.ownerCommittee === 'ISO/TC 2' || isoData.ownerCommittee.startsWith('ISO/TC 2/'))
		) {
			warnings.push(
				`${isoId}: Wrong committee (${isoData.ownerCommittee}), expected ISO/TC 2 (fasteners committee)`
			);
		}

		// 4. Check stage (withdrawn standards)
		if (isoData.currentStage >= 9599) {
			warnings.push(
				`${isoId}: WITHDRAWN (stage ${isoData.currentStage}), should be removed from config`
			);
		} else if (isoData.currentStage >= 9500) {
			warnings.push(
				`${isoId}: Under withdrawal review (stage ${isoData.currentStage}), will not appear in generated file`
			);
		}

		// 5. Check replacedBy (will be hidden in generated file)
		if (isoData.replacedBy && isoData.replacedBy.length > 0) {
			warnings.push(
				`${isoId}: Has replacement (${isoData.replacedBy.join(', ')}), will not appear in generated file`
			);
		}
	}

	// Report validation results
	if (errors.length > 0) {
		console.error(`\n❌ VALIDATION FAILED: ${errors.length} error(s) found\n`);
		errors.forEach((error) => console.error(`   ❌ ${error}`));
		console.error(
			'\n💡 These errors must be fixed before building. Please update data/standards-config.json\n'
		);
		process.exit(1);
	}

	if (warnings.length > 0) {
		console.warn(`\n⚠️  ${warnings.length} warning(s):\n`);
		warnings.forEach((warning) => console.warn(`   ⚠️  ${warning}`));
		console.warn('');
	} else {
		console.log('   ✅ All configuration entries are valid');
	}

	return true;
}

/**
 * Add designation system codes to designations array
 * @param {Array} designations - Array of designation objects to append to
 * @param {Object} crossref - Cross-reference object from config
 * @param {string} systemName - System name (e.g., 'DIN', 'ANSI', 'PN')
 */
function addDesignationSystem(designations, crossref, systemName) {
	const systemKey = systemName.toLowerCase();
	if (!crossref[systemKey]) return;

	const codes = Array.isArray(crossref[systemKey]) ? crossref[systemKey] : [crossref[systemKey]];

	codes.forEach((code) => {
		designations.push({ system: systemName, code: String(code) });
	});
}

/**
 * Find and add image and hardwareType to standard object
 * @param {Object} standard - Standard object to add image to
 * @param {string} standardId - Standard ID for lookup in mappings
 * @param {Object} imageMappings - image image mappings (can be string or {image, hardwareType})
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
			// Prefer hardwareType from image scraper (more accurate than heuristics)
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

// Main build function
async function buildStandards() {
	// Input files
	const isoDataFile = path.join(__dirname, '..', 'data', 'raw', 'iso_deliverables_metadata.jsonl');
	const configFile = path.join(__dirname, '..', 'data', 'standards-config.json');
	const imageMappingsFile = path.join(__dirname, '..', 'data', 'image-mappings.json');
	const outputFile = path.join(__dirname, '..', 'src', 'lib', 'data', 'standards-generated.ts');

	// Load configuration
	const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

	// Load image image mappings (single source of truth for image mappings)
	let imageMappings = {};
	try {
		imageMappings = JSON.parse(fs.readFileSync(imageMappingsFile, 'utf8'));
		console.log(`📋 Loaded ${Object.keys(imageMappings).length} image mappings from image`);
	} catch {
		console.log('📋 No image mappings found, continuing without them');
	}

	// Load ALL ISO data for validation (before filtering)
	console.log('📚 Loading ISO database for validation...');
	const isoDataMap = await loadAllISOData(isoDataFile);
	console.log(`   Loaded ${isoDataMap.size} ISO standards from database`);

	// Validate configuration against ISO database
	validateConfig(config, isoDataMap);

	// Process ISO standards (with filtering)
	console.log('\n📚 Processing ISO standards for output...');
	const isoStandards = await processISOData(isoDataFile);
	console.log(`   Found ${isoStandards.length} ISO standards that match fastener criteria`);

	// Process ISO standards with configurations
	const processedISO = isoStandards.map((std) => {
		const crossref = config.crossref[std.id] || {};

		// Build designations array
		const designations = [{ system: 'ISO', code: std.id.replace('iso', '') }];

		// Add cross-referenced systems
		addDesignationSystem(designations, crossref, 'DIN');
		addDesignationSystem(designations, crossref, 'ANSI');
		addDesignationSystem(designations, crossref, 'PN');

		// Build standard object
		// Prefer DIN as primarySystem if DIN designation exists
		const hasDIN = designations.some((d) => d.system === 'DIN');
		const standard = {
			id: std.id,
			primarySystem: hasDIN ? 'DIN' : 'ISO',
			description: std.title,
			designations,
			hardwareType: getHardwareType(designations, std.title)
		};

		// Add optional fields
		if (std.icsCode) standard.icsCode = std.icsCode;
		if (std.reference) standard.reference = std.reference;

		// Add image
		addImageToStandard(standard, std.id, imageMappings, designations);

		return standard;
	});

	console.log('🔩 Processing DIN-only standards...');

	// Process DIN-only standards
	const dinStandards = Object.entries(config.dinOnly).map(([id, dinConfig]) => {
		const dinNumber = id.replace('din', '');
		const designations = [{ system: 'DIN', code: dinNumber }];

		const standard = {
			id,
			primarySystem: 'DIN',
			description: dinConfig.description,
			designations,
			hardwareType: getHardwareType(designations, dinConfig.description)
		};

		// Add image
		addImageToStandard(standard, id, imageMappings, designations);

		return standard;
	});

	console.log(`   Found ${dinStandards.length} DIN-only standards`);

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
 * This file is automatically generated by scripts/build-all-standards.js
 * To update, modify the source data and run: pnpm build-standards
 * 
 * Generated: ${new Date().toISOString()}
 * Total standards: ${sortedStandards.length}
 * ISO standards: ${processedISO.length}
 * DIN-only standards: ${dinStandards.length}
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
	console.log(`   DIN-only standards: ${dinStandards.length}`);
	console.log(`   Standards with images: ${standardsWithImages}`);
	console.log(`   Output: ${outputFile}`);
}

// Run the build
buildStandards().catch(console.error);
