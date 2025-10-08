import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidUrl, isPrivateOrLocalUrl, isAllowedOrigin } from '$lib/utils/api-security';
import { RateLimiter } from '$lib/utils/rate-limiter';

// Per-user rate limiter: Extremely high limit (to be adjusted later based on usage)
const perUserRateLimiter = new RateLimiter({
	maxRequests: 100000,
	windowMs: 60 * 60 * 1000 // 1 hour
});

// Global rate limiter: Extremely high limit (to be adjusted later based on usage)
const globalRateLimiter = new RateLimiter({
	maxRequests: 100000,
	windowMs: 60 * 60 * 1000 // 1 hour
});

// Export for testing only
export const _rateLimiters = { perUserRateLimiter, globalRateLimiter };

/**
 * Attempts to shorten URL using is.gd API
 * @returns Shortened URL or null if failed
 */
async function tryIsGd(url: string): Promise<string | null> {
	try {
		const response = await fetch(
			`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
			{
				method: 'GET',
				headers: {
					'User-Agent': 'gridfinitylabels.com'
				}
			}
		);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		return data.shorturl || null;
	} catch {
		return null;
	}
}

/**
 * Attempts to shorten URL using TinyURL API
 * @returns Shortened URL or null if failed
 */
async function tryTinyUrl(url: string): Promise<string | null> {
	try {
		const response = await fetch(
			`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
			{
				method: 'GET'
			}
		);

		if (!response.ok) {
			return null;
		}

		const shortUrl = await response.text();
		return isValidUrl(shortUrl) ? shortUrl : null;
	} catch {
		return null;
	}
}

/**
 * Shortens URL using is.gd as primary, TinyURL as fallback
 * @throws Error if both providers fail with network errors
 */
async function shortenUrl(url: string): Promise<string> {
	// Try is.gd first
	const isGdResult = await tryIsGd(url);
	if (isGdResult) {
		return isGdResult;
	}

	// Fallback to TinyURL
	const tinyUrlResult = await tryTinyUrl(url);
	if (tinyUrlResult) {
		return tinyUrlResult;
	}

	// Both failed
	throw new Error('All URL shortening providers failed');
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		// 1. ORIGIN VALIDATION
		const origin = request.headers.get('origin');
		if (!isAllowedOrigin(origin)) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		// 2. RATE LIMITING - Per-user
		const clientIp = getClientAddress();
		const perUserLimit = perUserRateLimiter.check(clientIp);

		if (!perUserLimit.allowed) {
			return json(
				{ error: 'Rate limit exceeded' },
				{
					status: 429,
					headers: {
						'Retry-After': perUserLimit.retryAfter?.toString() || '3600'
					}
				}
			);
		}

		// 3. RATE LIMITING - Global (protects TinyURL quota)
		const globalLimit = globalRateLimiter.check('GLOBAL');

		if (!globalLimit.allowed) {
			return json(
				{ error: 'Rate limit exceeded' },
				{
					status: 429,
					headers: {
						'Retry-After': globalLimit.retryAfter?.toString() || '3600'
					}
				}
			);
		}

		// 4. REQUEST VALIDATION
		const { url } = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// 5. URL FORMAT VALIDATION
		if (!isValidUrl(url)) {
			return json({ error: 'Invalid URL format' }, { status: 400 });
		}

		// 6. SSRF PROTECTION
		if (isPrivateOrLocalUrl(url)) {
			return json({ error: 'Invalid URL' }, { status: 400 });
		}

		// 7. SHORTEN URL
		const shortUrl = await shortenUrl(url);

		return json({ shortUrl });
	} catch (error) {
		console.error('URL shortening error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
