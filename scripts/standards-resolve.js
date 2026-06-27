#!/usr/bin/env node
/**
 * Standards Resolve Script
 *
 * Resolves standard IDs to DIN Media page IDs by searching dinmedia.de.
 * Part of pipeline: validate → resolve → fetch → build
 *
 * DIN Media is the Single Source of Truth for both DIN and ISO standards.
 * ISO standards are searched as "EN ISO xxxx" (European harmonized versions).
 *
 * Uses Playwright for JavaScript-rendered search results.
 *
 * Usage:
 *   pnpm standards:resolve [--force] [--limit=N] [--delay=MS]
 *
 * Options:
 *   --force     Re-search all standards, even if already mapped
 *   --limit=N   Only process first N standards (for testing)
 *   --delay=MS  Delay between requests in milliseconds (default: 1500)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
	sleep,
	retryWithBackoff,
	acceptCookies,
	parseCliArgs,
	DEFAULT_USER_AGENT,
	DINMEDIA_BASE_URL
} from './lib/playwright-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primary source: standards-config.json (all standards we want to validate)
const CONFIG_FILE = path.join(__dirname, '../data/standards-config.json');

// Valid standard systems
// NOTE: Keep in sync with src/lib/utils/standards-config.ts
const VALID_SYSTEMS = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];
// Secondary source: image mappings (for backwards compatibility and additional standards)
const IMAGE_MAPPINGS_FILE = path.join(__dirname, '../data/image-mappings.json');
const OUTPUT_FILE = path.join(__dirname, '../data/dinmedia-id-mappings.json');
const REPORT_FILE = path.join(__dirname, '../data/dinmedia-mappings-report.json');

// Parse CLI arguments with validation
const { force: FORCE, limit: LIMIT, delay: REQUEST_DELAY_MS } = parseCliArgs(process.argv);

/**
 * Convert standard ID to search query
 *
 * DIN standards: din912 -> "DIN 912"
 * ISO standards: iso4762 -> "EN ISO 4762" (European harmonized version)
 *
 * Examples:
 *   din912 -> "DIN 912"
 *   iso4762 -> "EN ISO 4762"
 *   din7504k -> "DIN 7504"  (remove variant suffix)
 */
function standardIdToSearchQuery(id) {
	// Extract prefix (din, iso) and number
	const match = id.match(/^(din|iso)(\d+)([a-z])?$/i);
	if (!match) {
		return null;
	}

	const prefix = match[1].toLowerCase();
	const number = match[2];
	// Ignore variant suffix (k, m, o, p, etc.) - search for base standard

	if (prefix === 'din') {
		return `DIN ${number}`;
	} else if (prefix === 'iso') {
		// Search for European harmonized version: "EN ISO xxxx"
		// DIN Media has ISO standards as "DIN EN ISO xxxx"
		return `EN ISO ${number}`;
	}

	return null;
}

/**
 * Search DIN Media using Playwright and return first result's dinMediaId
 */
async function searchDinMedia(page, query) {
	// Use exact phrase search with quotes for better matching
	const exactQuery = `"${query}"`;
	const searchUrl = `${DINMEDIA_BASE_URL}/en/search/1052992!search?alx.searchType=complex&query=${encodeURIComponent(exactQuery)}&hitsPerPage=10`;

	await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

	// Wait for search results or "no results" message
	await page
		.locator('a[href*="/norm/"], a[href*="/standard/"], .search-no-results, .no-results')
		.first()
		.waitFor({ state: 'visible', timeout: 10000 })
		.catch(() => {
			// No results found or timeout - continue with extraction
		});

	// Extract dinMediaId from search results - handle both DE and EN URLs
	const dinMediaId = await page.evaluate((searchQuery) => {
		// Look for standard links: /de/norm/din-912/68034695 or /en/standard/...
		const links = document.querySelectorAll('a[href*="/norm/"], a[href*="/standard/"]');

		// Create a normalized version of the query for matching
		// "DIN 912" -> "din-912"
		// "EN ISO 4762" -> "en-iso-4762"
		const normalizedQuery = searchQuery.toLowerCase().replace(/\s+/g, '-');

		// For ISO standards, also try matching "din-en-iso-xxxx" pattern
		const isIsoSearch = searchQuery.startsWith('EN ISO');
		const isoNumber = isIsoSearch ? searchQuery.replace('EN ISO ', '') : null;

		for (const link of links) {
			const href = link.getAttribute('href') || '';
			// Match ID at end of URL
			const match = href.match(/\/(\d+)$/);
			if (match) {
				const urlLower = href.toLowerCase();

				// For ISO standards, match patterns like /din-en-iso-4762/ or /en-iso-4762/
				if (isIsoSearch && isoNumber) {
					if (
						urlLower.includes(`/din-en-iso-${isoNumber}/`) ||
						urlLower.includes(`/en-iso-${isoNumber}/`) ||
						urlLower.includes(`/iso-${isoNumber}/`)
					) {
						return match[1];
					}
				}

				// For DIN standards, exact match: /din-912/ not /din-en-912/
				if (!isIsoSearch && urlLower.includes(`/${normalizedQuery}/`)) {
					return match[1];
				}
			}
		}

		// Fallback: return first standard link if no exact match
		for (const link of links) {
			const href = link.getAttribute('href') || '';
			const match = href.match(/\/(\d+)$/);
			if (match) {
				return match[1];
			}
		}

		return null;
	}, query);

	return dinMediaId;
}

/**
 * Load existing mappings or return empty object
 */
async function loadExistingMappings() {
	try {
		const content = await fs.readFile(OUTPUT_FILE, 'utf-8');
		return JSON.parse(content);
	} catch {
		return {};
	}
}

/**
 * Save mappings to file
 */
async function saveMappings(mappings) {
	await fs.writeFile(OUTPUT_FILE, JSON.stringify(mappings, null, '\t'), 'utf-8');
}

/**
 * Load standard IDs from standards-config.json
 */
async function loadStandardIdsFromConfig() {
	const config = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8'));
	const ids = [];

	// Extract from all system sections (iso, din, ansi, pn, gb, jis)
	for (const system of VALID_SYSTEMS) {
		const section = config[system];
		if (section) {
			for (const number of Object.keys(section)) {
				ids.push(`${system}${number}`.toLowerCase());
			}
		}
	}

	return ids;
}

/**
 * Load standard IDs from image-mappings.json (for backwards compatibility)
 */
async function loadStandardIdsFromImageMappings() {
	try {
		const imageMappings = JSON.parse(await fs.readFile(IMAGE_MAPPINGS_FILE, 'utf-8'));
		return Object.keys(imageMappings).map((id) => id.toLowerCase());
	} catch {
		return [];
	}
}

/**
 * Main function
 */
async function main() {
	console.log('='.repeat(60));
	console.log('Generate DIN Media Mappings');
	console.log('='.repeat(60));
	console.log(`Mode: ${FORCE ? 'FORCE (re-search all)' : 'INCREMENTAL'}`);
	if (LIMIT !== Infinity) {
		console.log(`Limit: ${LIMIT} standards`);
	}
	console.log('');

	// Load standards from both sources
	console.log('Loading standards from config...');
	const configIds = await loadStandardIdsFromConfig();
	console.log(`  standards-config.json: ${configIds.length} standards`);

	const imageMappingIds = await loadStandardIdsFromImageMappings();
	console.log(`  image-mappings.json: ${imageMappingIds.length} standards`);

	// Combine and deduplicate
	const standardIds = [...new Set([...configIds, ...imageMappingIds])];
	console.log(`  Combined (unique): ${standardIds.length} standards\n`);

	// Load existing dinmedia mappings
	const existingMappings = FORCE ? {} : await loadExistingMappings();
	console.log(`Existing mappings: ${Object.keys(existingMappings).length}\n`);

	// Get unique base standards (din912, din912k -> din912)
	const uniqueStandards = new Map();
	for (const id of standardIds) {
		const query = standardIdToSearchQuery(id);
		if (query) {
			// Use base standard as key
			const baseId = id.replace(/[a-z]$/i, '').toLowerCase();
			if (!uniqueStandards.has(baseId)) {
				uniqueStandards.set(baseId, { id, query });
			}
		}
	}

	console.log(`Unique standards to search: ${uniqueStandards.size}\n`);

	// Stats
	const stats = {
		total: 0,
		success: 0,
		skipped: 0,
		notFound: 0,
		errors: 0
	};
	const failures = [];
	const newMappings = { ...existingMappings };

	// Launch browser
	console.log('Launching browser...');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
	const page = await context.newPage();

	// Accept cookies first
	console.log('Accepting cookies...');
	await acceptCookies(page, DINMEDIA_BASE_URL);
	console.log('Browser ready\n');

	try {
		// Process each unique standard
		let processed = 0;
		for (const [baseId, { id, query }] of uniqueStandards) {
			if (processed >= LIMIT) break;
			processed++;
			stats.total++;

			// Skip if already mapped (unless --force)
			if (!FORCE && existingMappings[baseId]) {
				console.log(
					`[${processed}/${Math.min(uniqueStandards.size, LIMIT)}] ${id} -> SKIPPED (already mapped)`
				);
				stats.skipped++;
				continue;
			}

			console.log(
				`[${processed}/${Math.min(uniqueStandards.size, LIMIT)}] ${id} -> searching "${query}"...`
			);

			try {
				const dinMediaId = await retryWithBackoff(() => searchDinMedia(page, query));

				if (dinMediaId) {
					newMappings[baseId] = {
						dinMediaId,
						searchQuery: query,
						originalId: id
					};
					console.log(`    Found: ${dinMediaId}`);
					stats.success++;
				} else {
					console.log(`    NOT FOUND`);
					stats.notFound++;
					failures.push({ id: baseId, query, reason: 'Not found on DIN Media' });
				}
			} catch (error) {
				console.log(`    ERROR: ${error.message}`);
				stats.errors++;
				failures.push({ id: baseId, query, reason: error.message });
			}

			// Rate limiting
			await sleep(REQUEST_DELAY_MS);
		}
	} finally {
		await browser.close();
		console.log('\nBrowser closed');
	}

	// Save mappings
	console.log('\nSaving mappings...');
	await saveMappings(newMappings);
	console.log(`Saved to: ${OUTPUT_FILE}`);

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('SUMMARY');
	console.log('='.repeat(60));
	console.log(`Total processed: ${stats.total}`);
	console.log(`Success: ${stats.success}`);
	console.log(`Skipped (already mapped): ${stats.skipped}`);
	console.log(`Not found: ${stats.notFound}`);
	console.log(`Errors: ${stats.errors}`);
	console.log(`Total mappings: ${Object.keys(newMappings).length}`);

	if (failures.length > 0) {
		console.log('\nFailures:');
		for (const f of failures.slice(0, 10)) {
			console.log(`  ${f.id} (${f.query}): ${f.reason}`);
		}
		if (failures.length > 10) {
			console.log(`  ... and ${failures.length - 10} more`);
		}
	}

	// Generate report
	const report = {
		timestamp: new Date().toISOString(),
		config: {
			force: FORCE,
			limit: LIMIT === Infinity ? null : LIMIT
		},
		summary: {
			totalProcessed: stats.total,
			success: stats.success,
			skipped: stats.skipped,
			notFound: stats.notFound,
			errors: stats.errors,
			totalMappings: Object.keys(newMappings).length
		},
		failures
	};

	await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
	console.log(`\nReport saved to: ${REPORT_FILE}`);

	// Exit with error if any failures (for CI)
	if (stats.notFound > 0 || stats.errors > 0) {
		console.log('\n⚠️  Some standards could not be mapped. Review failures above.');
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
