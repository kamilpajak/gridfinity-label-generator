#!/usr/bin/env node
/**
 * Merge image-mappings.json into standards-config.json
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const image_MAPPINGS = path.join(__dirname, '../data/image-mappings.json');
const CONFIG_FILE = path.join(__dirname, '../data/standards-config.json');

async function main() {
	console.log('🔄 Merging image mappings...\n');

	// Load both files
	const imageMappings = JSON.parse(await fs.readFile(image_MAPPINGS, 'utf-8'));
	const config = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8'));

	const oldCount = Object.keys(config.imageMappings || {}).length;

	// Replace entire imageMappings section with image mappings
	config.imageMappings = imageMappings;

	const newCount = Object.keys(config.imageMappings).length;

	// Write back
	await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, '\t') + '\n', 'utf-8');

	console.log(`✓ Old mappings: ${oldCount}`);
	console.log(`✓ New mappings: ${newCount}`);
	console.log(`✓ Difference: ${newCount - oldCount > 0 ? '+' : ''}${newCount - oldCount}\n`);
	console.log(`💾 Updated: ${CONFIG_FILE}`);
	console.log('\n💡 Next: run "pnpm run build-standards"');
}

main().catch(console.error);
