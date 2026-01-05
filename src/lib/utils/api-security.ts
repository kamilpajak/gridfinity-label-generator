/**
 * API Security Utilities
 *
 * Provides security functions for API endpoints including:
 * - URL validation
 * - SSRF protection using ipaddr.js
 * - Origin validation
 */

import * as ipaddr from 'ipaddr.js';

const PRODUCTION_DOMAIN = 'gridfinitylabels.com';
const ALLOWED_ORIGINS = [
	`https://${PRODUCTION_DOMAIN}`,
	`https://www.${PRODUCTION_DOMAIN}`,
	// Development origins
	'http://localhost:5173',
	'http://localhost:4173',
	'http://localhost:3000',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:4173',
	'http://127.0.0.1:3000'
];

/**
 * Validates if a string is a valid HTTP/HTTPS URL
 * @param urlString - The URL string to validate
 * @returns true if valid HTTP/HTTPS URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
	if (!urlString || typeof urlString !== 'string') {
		return false;
	}

	try {
		const url = new URL(urlString);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Sanitizes a URL by trimming whitespace and converting to lowercase
 * @param url - The URL to sanitize
 * @returns Sanitized URL string
 */
export function sanitizeUrl(url: string): string {
	if (!url) return '';
	return url.trim().toLowerCase();
}

/**
 * Checks if a URL points to a private/local network address (SSRF protection)
 * Uses ipaddr.js for comprehensive IP address validation including:
 * - Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Loopback addresses (127.0.0.0/8, ::1)
 * - Link-local addresses (169.254.0.0/16, fe80::/10)
 * - Private IPv6 ranges (fc00::/7)
 * - Multicast addresses
 * - Reserved ranges
 * - Handles octal/hex notation, IPv6 compression, embedded IPv4
 *
 * @param urlString - The URL to check
 * @returns true if the URL is private/local, false if public
 */
export function isPrivateOrLocalUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		let hostname = url.hostname;

		// Check for explicit localhost string
		if (hostname === 'localhost') {
			return true;
		}

		// IPv6 addresses in URLs are enclosed in brackets []
		// URL.hostname returns them without brackets, which is what we need
		// However, ipaddr.js needs the clean format
		// Remove any remaining brackets (shouldn't happen but be safe)
		hostname = hostname.replace(/^(\[)|(\])$/g, '');

		// Try to parse as IP address using ipaddr.js
		if (ipaddr.isValid(hostname)) {
			const addr = ipaddr.parse(hostname);

			// ipaddr.js range() returns the address type:
			// 'unicast' - Global unicast (public)
			// 'private' - Private ranges (RFC 1918)
			// 'loopback' - Loopback addresses
			// 'linkLocal' - Link-local addresses
			// 'uniqueLocal' - IPv6 unique local (fc00::/7)
			// 'multicast' - Multicast addresses
			// 'broadcast' - Broadcast address
			// 'reserved' - Reserved ranges
			// 'unspecified' - Unspecified address (0.0.0.0, ::)
			// 'carrierGradeNat' - Carrier-grade NAT (100.64.0.0/10)

			const range = addr.range();

			// Only allow 'unicast' (public addresses)
			// Everything else is considered private/local for SSRF protection
			return range !== 'unicast';
		}

		// Not an IP address (domain name) - allow through
		// Domain validation happens separately via isValidUrl()
		return false;
	} catch {
		// Invalid URL, treat as non-private (will be caught by validation)
		return false;
	}
}

/**
 * Validates if an origin is allowed to access the API
 * @param origin - The origin header value to check
 * @returns true if origin is allowed, false otherwise
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
	if (!origin) {
		return false;
	}

	const normalizedOrigin = origin.toLowerCase();

	return ALLOWED_ORIGINS.some((allowed) => allowed.toLowerCase() === normalizedOrigin);
}
