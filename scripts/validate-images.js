#!/usr/bin/env node
/**
 * Validate that all image references in standards have corresponding files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	console.log('🔍 Validating standard images...\n');

	// Load generated standards
	const generatedFile = path.join(__dirname, '../src/lib/data/standards-generated.ts');
	const content = await fs.readFile(generatedFile, 'utf-8');

	// Extract all image paths using regex
	// Support both single and double quotes
	const imageRegex = /image:\s*['"]([^'"]+)['"]/g;
	const images = new Set();
	let match;

	while ((match = imageRegex.exec(content)) !== null) {
		images.add(match[1]);
	}

	console.log(`📊 Found ${images.size} unique image references\n`);

	const missing = [];
	const existing = [];

	for (const imagePath of images) {
		// Convert /images/standards/foo.png to static/images/standards/foo.png
		const filePath = path.join(__dirname, '..', 'static', imagePath);

		try {
			await fs.access(filePath);
			existing.push(imagePath);
		} catch {
			missing.push(imagePath);
		}
	}

	console.log(`✓ Existing: ${existing.length}`);
	console.log(`✗ Missing:  ${missing.length}\n`);

	if (missing.length > 0) {
		console.log('❌ Missing image files:\n');
		missing.forEach((img) => console.log(`  ${img}`));
		console.log(`\n💡 Add the missing image files or remove these standards from config`);
		process.exit(1);
	} else {
		console.log('✅ All images validated successfully!');
	}
}

main().catch(console.error);
