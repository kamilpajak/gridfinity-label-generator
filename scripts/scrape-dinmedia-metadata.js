#!/usr/bin/env node
/**
 * Scrape DIN Media Metadata Script
 *
 * Fetches metadata (title, status, date) from dinmedia.de for each mapped standard.
 * Uses cached data to avoid re-fetching recent entries.
 *
 * Uses Playwright for JavaScript-rendered pages.
 *
 * Usage:
 *   node scripts/scrape-dinmedia-metadata.js [--force] [--limit=N] [--delay=MS]
 *
 * Options:
 *   --force     Re-fetch all metadata, ignoring cache
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

const MAPPINGS_FILE = path.join(__dirname, '../data/dinmedia-id-mappings.json');
const CACHE_FILE = path.join(__dirname, '../data/dinmedia-metadata-cache.json');
const REPORT_FILE = path.join(__dirname, '../data/dinmedia-scrape-report.json');

// Cache validity (days) - current standards refresh monthly, withdrawn more frequently
const CACHE_MAX_AGE_DAYS = 30;
const CACHE_MAX_AGE_WITHDRAWN_DAYS = 7;

// Parse CLI arguments with validation
const { force: FORCE, limit: LIMIT, delay: REQUEST_DELAY_MS } = parseCliArgs(process.argv);

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry) {
	if (!entry || !entry.fetchedAt) return false;

	const fetchedAt = new Date(entry.fetchedAt);
	const now = new Date();
	const ageMs = now - fetchedAt;
	const ageDays = ageMs / (1000 * 60 * 60 * 24);

	// Withdrawn standards refresh more frequently
	const maxAgeDays =
		entry.status === 'WITHDRAWN' ? CACHE_MAX_AGE_WITHDRAWN_DAYS : CACHE_MAX_AGE_DAYS;

	return ageDays < maxAgeDays;
}

/**
 * Fetch metadata from a standard's detail page
 */
async function fetchMetadata(page, dinMediaId) {
	// Direct URL with just the ID - DIN Media will redirect to full URL
	const url = `${DINMEDIA_BASE_URL}/en/standard/-/${dinMediaId}`;

	await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

	// Wait for main content to load (h1 with standard designation)
	await page
		.locator('h1')
		.first()
		.waitFor({ state: 'visible', timeout: 10000 })
		.catch(() => {
			// Page might have different structure, continue with extraction
		});

	// Extract metadata from page
	const metadata = await page.evaluate(() => {
		const result = {
			designation: null,
			titleEn: null,
			status: null,
			publicationDate: null
		};

		// Designation from h1 (e.g., "DIN 912:2009-09")
		const h1 = document.querySelector('h1');
		if (h1) {
			result.designation = h1.textContent.trim();
		}

		// Title from h2
		const h2 = document.querySelector('h2');
		if (h2) {
			result.titleEn = h2.textContent.trim();
		}

		// Status (CURRENT, WITHDRAWN, etc.)
		const statusMatch = document.body.innerHTML.match(
			/\[(CURRENT|WITHDRAWN|NEW|PRE-ORDER|AKTUELL|ZURÜCKGEZOGEN|NEU|VORBESTELLBAR)\]/i
		);
		if (statusMatch) {
			// Normalize to English
			const statusMap = {
				AKTUELL: 'CURRENT',
				ZURÜCKGEZOGEN: 'WITHDRAWN',
				NEU: 'NEW',
				VORBESTELLBAR: 'PRE-ORDER'
			};
			result.status = statusMap[statusMatch[1].toUpperCase()] || statusMatch[1].toUpperCase();
		}

		// Publication date from dt/dd pair
		const dts = document.querySelectorAll('dt');
		for (const dt of dts) {
			const text = dt.textContent.toLowerCase();
			if (text.includes('publication date') || text.includes('ausgabedatum')) {
				const dd = dt.nextElementSibling;
				if (dd && dd.tagName === 'DD') {
					result.publicationDate = dd.textContent.trim();
				}
				break;
			}
		}

		return result;
	});

	return {
		...metadata,
		dinMediaId,
		url: page.url(),
		fetchedAt: new Date().toISOString()
	};
}

/**
 * Load existing cache or return empty object
 */
async function loadCache() {
	try {
		const content = await fs.readFile(CACHE_FILE, 'utf-8');
		return JSON.parse(content);
	} catch {
		return {
			_meta: {
				version: '1.0',
				lastUpdate: null
			}
		};
	}
}

/**
 * Save cache to file
 */
async function saveCache(cache) {
	cache._meta.lastUpdate = new Date().toISOString();
	await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, '\t'), 'utf-8');
}

/**
 * Main function
 */
async function main() {
	console.log('='.repeat(60));
	console.log('Scrape DIN Media Metadata');
	console.log('='.repeat(60));
	console.log(`Mode: ${FORCE ? 'FORCE (re-fetch all)' : 'INCREMENTAL'}`);
	if (LIMIT !== Infinity) {
		console.log(`Limit: ${LIMIT} standards`);
	}
	console.log('');

	// Load mappings
	console.log('Loading mappings...');
	const mappings = JSON.parse(await fs.readFile(MAPPINGS_FILE, 'utf-8'));
	const mappingEntries = Object.entries(mappings);
	console.log(`Found ${mappingEntries.length} mapped standards\n`);

	// Get unique dinMediaIds
	const uniqueIds = new Map();
	for (const [standardId, mapping] of mappingEntries) {
		const { dinMediaId } = mapping;
		if (!uniqueIds.has(dinMediaId)) {
			uniqueIds.set(dinMediaId, standardId);
		}
	}
	console.log(`Unique dinMediaIds: ${uniqueIds.size}\n`);

	// Load cache
	const cache = FORCE ? { _meta: { version: '1.0', lastUpdate: null } } : await loadCache();
	console.log(`Cached entries: ${Object.keys(cache).length - 1}\n`);

	// Stats
	const stats = {
		total: 0,
		fetched: 0,
		cached: 0,
		errors: 0
	};
	const failures = [];

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
		// Process each unique dinMediaId
		let processed = 0;
		for (const [dinMediaId, standardId] of uniqueIds) {
			if (processed >= LIMIT) break;
			processed++;
			stats.total++;

			// Check cache (unless --force)
			if (!FORCE && cache[dinMediaId] && isCacheValid(cache[dinMediaId])) {
				console.log(
					`[${processed}/${Math.min(uniqueIds.size, LIMIT)}] ${dinMediaId} (${standardId}) -> CACHED`
				);
				stats.cached++;
				continue;
			}

			console.log(
				`[${processed}/${Math.min(uniqueIds.size, LIMIT)}] ${dinMediaId} (${standardId}) -> fetching...`
			);

			try {
				const metadata = await retryWithBackoff(() => fetchMetadata(page, dinMediaId));
				cache[dinMediaId] = metadata;

				console.log(`    Title: ${metadata.titleEn || 'N/A'}`);
				console.log(`    Status: ${metadata.status || 'N/A'}`);
				stats.fetched++;
			} catch (error) {
				console.log(`    ERROR: ${error.message}`);
				stats.errors++;
				failures.push({ dinMediaId, standardId, reason: error.message });
			}

			// Rate limiting
			await sleep(REQUEST_DELAY_MS);
		}
	} finally {
		await browser.close();
		console.log('\nBrowser closed');
	}

	// Save cache
	console.log('\nSaving cache...');
	await saveCache(cache);
	console.log(`Saved to: ${CACHE_FILE}`);

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('SUMMARY');
	console.log('='.repeat(60));
	console.log(`Total processed: ${stats.total}`);
	console.log(`Fetched: ${stats.fetched}`);
	console.log(`From cache: ${stats.cached}`);
	console.log(`Errors: ${stats.errors}`);
	console.log(`Total cached: ${Object.keys(cache).length - 1}`);

	if (failures.length > 0) {
		console.log('\nFailures:');
		for (const f of failures.slice(0, 10)) {
			console.log(`  ${f.dinMediaId} (${f.standardId}): ${f.reason}`);
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
			fetched: stats.fetched,
			cached: stats.cached,
			errors: stats.errors,
			totalCached: Object.keys(cache).length - 1
		},
		failures
	};

	await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
	console.log(`\nReport saved to: ${REPORT_FILE}`);

	// Exit with error if any failures (for CI)
	if (stats.errors > 0) {
		console.log('\n⚠️  Some standards could not be scraped. Review failures above.');
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
