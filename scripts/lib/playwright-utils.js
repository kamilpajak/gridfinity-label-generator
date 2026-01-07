/**
 * Shared Playwright Utilities
 *
 * Common functions used by DIN Media scraping scripts.
 * Extracted to reduce code duplication.
 */

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} baseDelayMs - Base delay in milliseconds (default: 1000)
 * @returns {Promise<any>} Result of the function
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelayMs = 1000) {
	let lastError;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt < maxRetries) {
				const delay = baseDelayMs * Math.pow(2, attempt - 1);
				console.log(`    Retry ${attempt}/${maxRetries} after ${delay}ms...`);
				await sleep(delay);
			}
		}
	}
	throw lastError;
}

/**
 * Accept cookies on DIN Media website
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {string} baseUrl - Base URL of the website
 */
export async function acceptCookies(page, baseUrl) {
	await page.goto(`${baseUrl}/en/`, { waitUntil: 'networkidle', timeout: 30000 });
	try {
		const acceptButton = page.locator('text=Accept all').or(page.locator('text=Alle akzeptieren'));
		await acceptButton.first().waitFor({ state: 'visible', timeout: 5000 });
		await acceptButton.first().click();
		// Wait for cookie banner to disappear
		await acceptButton
			.first()
			.waitFor({ state: 'hidden', timeout: 3000 })
			.catch(() => {});
	} catch {
		// Cookie banner might not appear, continue
	}
}

/**
 * Parse CLI arguments for common options
 * @param {string[]} argv - Process arguments (process.argv)
 * @returns {{ force: boolean, limit: number, delay: number }}
 */
export function parseCliArgs(argv) {
	const force = argv.includes('--force');

	// Parse --limit=N with validation
	const limitArg = argv.find((arg) => arg.startsWith('--limit='));
	let limit = Infinity;
	if (limitArg) {
		const parsed = parseInt(limitArg.split('=')[1], 10);
		if (isNaN(parsed) || parsed <= 0) {
			console.error(`Error: Invalid --limit value. Must be a positive integer.`);
			process.exit(1);
		}
		limit = parsed;
	}

	// Parse --delay=N with validation (in milliseconds)
	const delayArg = argv.find((arg) => arg.startsWith('--delay='));
	let delay = 1500; // Default delay
	if (delayArg) {
		const parsed = parseInt(delayArg.split('=')[1], 10);
		if (isNaN(parsed) || parsed < 0) {
			console.error(`Error: Invalid --delay value. Must be a non-negative integer.`);
			process.exit(1);
		}
		delay = parsed;
	}

	return { force, limit, delay };
}

/**
 * Default User-Agent for scraping
 */
export const DEFAULT_USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Default DIN Media base URL
 */
export const DINMEDIA_BASE_URL = 'https://www.dinmedia.de';
