import { describe, it, expect, vi } from 'vitest';

// The allowlist is now env-driven; production/self-host origins come from
// PUBLIC_ALLOWED_ORIGINS. Mock it to the reference deployment for these tests.
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_ALLOWED_ORIGINS: 'https://gridfinitylabels.com,https://www.gridfinitylabels.com' }
}));

import { isValidUrl, isPrivateOrLocalUrl, isAllowedOrigin, sanitizeUrl } from './api-security';

describe('URL Validation', () => {
	describe('isValidUrl', () => {
		it('should accept valid HTTP URLs', () => {
			expect(isValidUrl('http://example.com')).toBe(true);
		});

		it('should accept valid HTTPS URLs', () => {
			expect(isValidUrl('https://example.com')).toBe(true);
		});

		it('should reject invalid URL formats', () => {
			expect(isValidUrl('not-a-url')).toBe(false);
			expect(isValidUrl('javascript:alert(1)')).toBe(false); // NOSONAR - Testing security: URL validation must reject javascript: protocol
			expect(isValidUrl('')).toBe(false);
		});

		it('should reject non-HTTP protocols', () => {
			expect(isValidUrl('ftp://example.com')).toBe(false);
			expect(isValidUrl('file:///etc/passwd')).toBe(false);
			expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
		});

		it('should handle URLs with paths and parameters', () => {
			expect(isValidUrl('https://example.com/path?param=value')).toBe(true);
		});
	});

	describe('sanitizeUrl', () => {
		it('should trim whitespace from URLs', () => {
			expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
		});

		it('should convert to lowercase', () => {
			expect(sanitizeUrl('HTTPS://EXAMPLE.COM')).toBe('https://example.com');
		});

		it('should handle empty strings', () => {
			expect(sanitizeUrl('')).toBe('');
		});
	});
});

describe('SSRF Protection', () => {
	describe('isPrivateOrLocalUrl', () => {
		it('should detect localhost', () => {
			expect(isPrivateOrLocalUrl('http://localhost')).toBe(true);
			expect(isPrivateOrLocalUrl('http://localhost:3000')).toBe(true);
			expect(isPrivateOrLocalUrl('https://localhost')).toBe(true);
		});

		it('should detect 127.0.0.1', () => {
			expect(isPrivateOrLocalUrl('http://127.0.0.1')).toBe(true);
			expect(isPrivateOrLocalUrl('http://127.0.0.1:8080')).toBe(true);
		});

		it('should detect 192.168.x.x private range', () => {
			expect(isPrivateOrLocalUrl('http://192.168.1.1')).toBe(true);
			expect(isPrivateOrLocalUrl('http://192.168.0.100')).toBe(true);
			expect(isPrivateOrLocalUrl('http://192.168.255.255')).toBe(true);
		});

		it('should detect 10.x.x.x private range', () => {
			expect(isPrivateOrLocalUrl('http://10.0.0.1')).toBe(true);
			expect(isPrivateOrLocalUrl('http://10.255.255.255')).toBe(true);
		});

		it('should detect 172.16.x.x - 172.31.x.x private range', () => {
			expect(isPrivateOrLocalUrl('http://172.16.0.1')).toBe(true);
			expect(isPrivateOrLocalUrl('http://172.31.255.255')).toBe(true);
		});

		it('should allow public IP addresses', () => {
			expect(isPrivateOrLocalUrl('http://8.8.8.8')).toBe(false);
			expect(isPrivateOrLocalUrl('http://1.1.1.1')).toBe(false);
			expect(isPrivateOrLocalUrl('https://example.com')).toBe(false);
		});

		it('should detect link-local addresses (169.254.x.x)', () => {
			expect(isPrivateOrLocalUrl('http://169.254.1.1')).toBe(true);
			expect(isPrivateOrLocalUrl('http://169.254.169.254')).toBe(true); // AWS metadata
		});

		it('should handle invalid URLs gracefully', () => {
			expect(isPrivateOrLocalUrl('not-a-url')).toBe(false);
		});

		// Tests for advanced ipaddr.js features
		it('should detect octal IPv4 notation (SSRF bypass attempt)', () => {
			expect(isPrivateOrLocalUrl('http://0177.0.0.1')).toBe(true); // Octal 127.0.0.1
			expect(isPrivateOrLocalUrl('http://017700000001')).toBe(true); // Octal localhost
		});

		it('should detect hex IPv4 notation', () => {
			expect(isPrivateOrLocalUrl('http://0x7f000001')).toBe(true); // Hex 127.0.0.1
		});

		it('should detect IPv6 loopback in various formats', () => {
			expect(isPrivateOrLocalUrl('http://[::1]')).toBe(true); // Compressed
			expect(isPrivateOrLocalUrl('http://[0:0:0:0:0:0:0:1]')).toBe(true); // Expanded
		});

		it('should detect IPv6 link-local addresses', () => {
			expect(isPrivateOrLocalUrl('http://[fe80::1]')).toBe(true);
			expect(isPrivateOrLocalUrl('http://[fe80:0000:0000:0000:0202:b3ff:fe1e:8329]')).toBe(true);
		});

		it('should detect IPv6 unique local addresses (fc00::/7)', () => {
			expect(isPrivateOrLocalUrl('http://[fc00::1]')).toBe(true);
			expect(isPrivateOrLocalUrl('http://[fd12:3456:789a:1::1]')).toBe(true);
		});

		it('should detect IPv6 embedded IPv4', () => {
			expect(isPrivateOrLocalUrl('http://[::ffff:192.168.1.1]')).toBe(true); // Private IPv4
			expect(isPrivateOrLocalUrl('http://[::ffff:127.0.0.1]')).toBe(true); // Loopback
		});

		it('should detect multicast addresses', () => {
			expect(isPrivateOrLocalUrl('http://224.0.0.1')).toBe(true); // IPv4 multicast
			expect(isPrivateOrLocalUrl('http://[ff02::1]')).toBe(true); // IPv6 multicast
		});

		it('should detect carrier-grade NAT range (100.64.0.0/10)', () => {
			expect(isPrivateOrLocalUrl('http://100.64.0.1')).toBe(true);
			expect(isPrivateOrLocalUrl('http://100.127.255.255')).toBe(true);
		});

		it('should detect unspecified addresses', () => {
			expect(isPrivateOrLocalUrl('http://0.0.0.0')).toBe(true);
			expect(isPrivateOrLocalUrl('http://[::]')).toBe(true);
		});

		it('should allow public IPv6 addresses', () => {
			expect(isPrivateOrLocalUrl('http://[2001:4860:4860::8888]')).toBe(false); // Google DNS
		});
	});
});

describe('Origin Validation', () => {
	describe('isAllowedOrigin', () => {
		it('should allow production domain', () => {
			expect(isAllowedOrigin('https://gridfinitylabels.com')).toBe(true);
		});

		it('should allow www subdomain', () => {
			expect(isAllowedOrigin('https://www.gridfinitylabels.com')).toBe(true);
		});

		it('should allow localhost in development', () => {
			expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
			expect(isAllowedOrigin('http://localhost:4173')).toBe(true);
			expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
		});

		it('should allow 127.0.0.1 in development', () => {
			expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
		});

		it('should reject unknown origins', () => {
			expect(isAllowedOrigin('https://evil.com')).toBe(false);
			expect(isAllowedOrigin('http://malicious.com')).toBe(false);
		});

		it('should reject null origin', () => {
			expect(isAllowedOrigin(null)).toBe(false);
		});

		it('should reject undefined origin', () => {
			expect(isAllowedOrigin(undefined)).toBe(false);
		});

		it('should reject empty string origin', () => {
			expect(isAllowedOrigin('')).toBe(false);
		});

		it('should be case-insensitive', () => {
			expect(isAllowedOrigin('HTTPS://GRIDFINITYLABELS.COM')).toBe(true);
		});

		it('should reject subdomain spoofing attempts', () => {
			expect(isAllowedOrigin('https://gridfinitylabels.com.evil.com')).toBe(false);
			expect(isAllowedOrigin('https://fakegridfinitylabels.com')).toBe(false);
		});
	});
});
