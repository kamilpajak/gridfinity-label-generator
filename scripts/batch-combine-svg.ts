#!/usr/bin/env npx tsx
/**
 * Batch SVG Combiner - Orchestrator
 *
 * Processes a directory of Würth SVG files, groups back+left pairs,
 * and combines them into single SVG files.
 *
 * Usage:
 *   npx tsx scripts/batch-combine-svg.ts <input-dir> [output-dir]
 *
 * Example:
 *   npx tsx scripts/batch-combine-svg.ts ~/Downloads static/images/standards
 *
 * The script will:
 * 1. Scan input directory for *_BACK.svg and *_LEFT.svg files
 * 2. Group matching pairs by their base name
 * 3. Extract standard ID from filename (e.g., DIN_6912 → din_6912.svg)
 * 4. Combine each pair using combine-svg-views.js
 * 5. Output to the specified directory (or input dir if not specified)
 */

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { groupFiles, type SvgFilePair } from '../src/lib/utils/svg-batch-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CombineResult {
	success: boolean;
	output: string;
	error?: string;
}

/**
 * Combine a single pair using combine-svg-views.ts
 */
function combinePair(inputDir: string, outputDir: string, pair: SvgFilePair): CombineResult {
	const combineScript = join(__dirname, 'combine-svg-views.ts');
	const backPath = join(inputDir, pair.back);
	const leftPath = join(inputDir, pair.left);
	const outputPath = join(outputDir, pair.outputName);

	try {
		execSync(`npx tsx "${combineScript}" "${backPath}" "${leftPath}" "${outputPath}"`, {
			stdio: 'pipe'
		});
		return { success: true, output: pair.outputName };
	} catch (error) {
		return { success: false, output: pair.outputName, error: (error as Error).message };
	}
}

/**
 * Main function
 */
function main(): void {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		console.error('Usage: npx tsx scripts/batch-combine-svg.ts <input-dir> [output-dir]');
		console.error('');
		console.error('Example:');
		console.error('  npx tsx scripts/batch-combine-svg.ts ~/Downloads');
		console.error('  npx tsx scripts/batch-combine-svg.ts ~/Downloads static/images/standards');
		process.exit(1);
	}

	const inputDir = args[0];
	const outputDir = args[1] || inputDir;

	// Validate input directory
	if (!existsSync(inputDir)) {
		console.error(`Error: Input directory does not exist: ${inputDir}`);
		process.exit(1);
	}

	// Create output directory if needed
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
		console.log(`Created output directory: ${outputDir}`);
	}

	console.log(`\nBatch SVG Combiner`);
	console.log(`==================`);
	console.log(`Input:  ${inputDir}`);
	console.log(`Output: ${outputDir}`);
	console.log('');

	// Find all SVG files
	const allFiles = readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith('.svg'));
	console.log(`Found ${allFiles.length} SVG files`);

	// Group into pairs using shared utility
	const pairs = groupFiles(allFiles);
	console.log(`Found ${pairs.length} complete pairs (back + left)`);
	console.log('');

	if (pairs.length === 0) {
		console.log('No pairs to process. Exiting.');
		process.exit(0);
	}

	// Process each pair
	let successCount = 0;
	let failCount = 0;

	for (const pair of pairs) {
		const result = combinePair(inputDir, outputDir, pair);
		if (result.success) {
			console.log(`  ✓ ${result.output}`);
			successCount++;
		} else {
			console.log(`  ✗ ${result.output}: ${result.error}`);
			failCount++;
		}
	}

	console.log('');
	console.log(`Done: ${successCount} succeeded, ${failCount} failed`);
}

// Run main only when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
