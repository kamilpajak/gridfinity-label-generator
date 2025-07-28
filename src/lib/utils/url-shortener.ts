/**
 * URL Shortening Utility
 *
 * Provides URL shortening functionality using TinyURL API
 * for QR code generation in labels
 */

export interface URLShortenerResponse {
	success: boolean;
	shortUrl?: string;
	error?: string;
}

/**
 * Shortens a URL using the TinyURL service
 * @param longUrl - The URL to shorten
 * @returns Promise with shortened URL or error
 */
export async function shortenUrl(longUrl: string): Promise<URLShortenerResponse> {
	try {
		// Call our SvelteKit API endpoint
		const response = await fetch('/api/shorten', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url: longUrl })
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				success: false,
				error: errorData.error || 'Failed to shorten URL'
			};
		}

		const data = await response.json();
		return {
			success: true,
			shortUrl: data.shortUrl
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}

/**
 * Determines if a URL should be shortened based on length
 * @param url - The URL to check
 * @param maxLength - Maximum length before shortening (default: 50)
 * @returns boolean indicating if URL should be shortened
 */
export function shouldShortenUrl(url: string, maxLength: number = 50): boolean {
	return url.length > maxLength;
}

/**
 * Validates if a string is a valid URL
 * @param urlString - The string to validate
 * @returns boolean indicating if the string is a valid URL
 */
export function isValidUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
