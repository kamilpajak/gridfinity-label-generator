/* eslint-disable @typescript-eslint/no-explicit-any -- Mock contexts don't match exact RequestEvent type signature */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, _rateLimiters } from './+server';

// Mock fetch for is.gd and TinyURL APIs
global.fetch = vi.fn();

const { globalRateLimiter } = _rateLimiters;

describe('POST /api/shorten', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset rate limiters before each test suite
		// Note: This resets the entire limiter, not per-test
	});

	const createMockContext = (
		body: unknown,
		origin: string | null = 'https://gridfinitylabels.com',
		ip: string = '1.2.3.4'
	) => {
		const headers = new Headers();
		if (origin) {
			headers.set('origin', origin);
		}
		headers.set('content-type', 'application/json');

		return {
			request: new Request('http://localhost/api/shorten', {
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			}),
			getClientAddress: () => ip
		};
	};

	describe('Origin Validation', () => {
		it('should reject requests from unauthorized origins', async () => {
			const context = createMockContext({ url: 'https://example.com' }, 'https://evil.com');

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe('Forbidden');
		});

		it('should accept requests from production domain', async () => {
			const context = createMockContext(
				{ url: 'https://example.com' },
				'https://gridfinitylabels.com'
			);

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			const response = await POST(context as any);

			expect(response.status).toBe(200);
		});

		it('should accept requests from localhost in development', async () => {
			const context = createMockContext({ url: 'https://example.com' }, 'http://localhost:5173');

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			const response = await POST(context as any);

			expect(response.status).toBe(200);
		});

		it('should reject requests without origin header', async () => {
			const context = createMockContext({ url: 'https://example.com' }, null);

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe('Forbidden');
		});
	});

	// Skipped: Rate limits set to 100,000/hour (effectively disabled) until real usage data is collected
	describe.skip('Rate Limiting', () => {
		it('should allow requests within rate limit', async () => {
			const context = createMockContext({ url: 'https://example.com' }, undefined, '2.2.2.2');

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			const response = await POST(context as any);

			expect(response.status).toBe(200);
		});

		it('should block requests exceeding rate limit', async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			// Make multiple requests to exceed limit (20 per hour)
			for (let i = 0; i < 20; i++) {
				const context = createMockContext({ url: 'https://example.com' }, undefined, '3.3.3.3');
				await POST(context as any);
			}

			// 21st request should be blocked
			const context = createMockContext({ url: 'https://example.com' }, undefined, '3.3.3.3');
			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(429);
			expect(data.error).toBe('Rate limit exceeded');
			expect(response.headers.get('Retry-After')).toBeTruthy();
		});

		it('should track rate limits per IP address', async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			// IP 1 makes 20 requests
			for (let i = 0; i < 20; i++) {
				const context = createMockContext({ url: 'https://example.com' }, undefined, '4.4.4.4');
				await POST(context as any);
			}

			// IP 2 should still be allowed
			const context2 = createMockContext({ url: 'https://example.com' }, undefined, '5.5.5.5');
			const response = await POST(context2 as any);

			expect(response.status).toBe(200);
		});

		it('should enforce global rate limit across all users', async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			// Make requests from 10 different IPs to exceed global limit (180/hour)
			// Each IP makes 19 requests = 190 total requests
			for (let ip = 20; ip < 30; ip++) {
				for (let req = 0; req < 19; req++) {
					const context = createMockContext(
						{ url: 'https://example.com' },
						undefined,
						`12.12.12.${ip}`
					);
					await POST(context as any);
				}
			}

			// Next request should be blocked by global limit
			const context = createMockContext({ url: 'https://example.com' }, undefined, '12.12.12.200');
			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(429);
			expect(data.error).toContain('Rate limit exceeded');
		});

		it('should return appropriate message when global limit exceeded', async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			// Exceed global limit
			for (let ip = 40; ip < 50; ip++) {
				for (let req = 0; req < 19; req++) {
					const context = createMockContext(
						{ url: 'https://example.com' },
						undefined,
						`13.13.13.${ip}`
					);
					await POST(context as any);
				}
			}

			const context = createMockContext({ url: 'https://example.com' }, undefined, '13.13.13.200');
			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(429);
			expect(data.error).toBe('Rate limit exceeded');
			expect(response.headers.get('Retry-After')).toBeTruthy();
		});
	});

	describe('URL Validation', () => {
		it('should reject requests without URL', async () => {
			globalRateLimiter.reset('GLOBAL'); // Reset for clean test
			const context = createMockContext({});

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('URL is required');
		});

		it('should reject invalid URL format', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'not-a-valid-url' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL format');
		});

		it('should reject non-HTTP protocols', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'ftp://example.com' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL format');
		});
	});

	describe('SSRF Protection', () => {
		it('should block localhost URLs', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'http://localhost/admin' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL');
		});

		it('should block 127.0.0.1', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'http://127.0.0.1:8080' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL');
		});

		it('should block private IP ranges (192.168.x.x)', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'http://192.168.1.1' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL');
		});

		it('should block private IP ranges (10.x.x.x)', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'http://10.0.0.1' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL');
		});

		it('should block AWS metadata endpoint', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'http://169.254.169.254/latest/meta-data/' });

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid URL');
		});

		it('should allow public URLs', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'https://example.com' }, undefined, '6.6.6.6');

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			const response = await POST(context as any);

			expect(response.status).toBe(200);
		});
	});

	describe('URL Shortener Integration', () => {
		it('should return shortened URL from is.gd on success', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext(
				{ url: 'https://example.com/very/long/path' },
				undefined,
				'7.7.7.7'
			);

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ shorturl: 'https://is.gd/abc123' })
			} as Response);

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.shortUrl).toBe('https://is.gd/abc123');
		});

		it('should fallback to TinyURL when is.gd fails', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'https://example.com' }, undefined, '8.8.8.8');

			// First call (is.gd) fails
			// Second call (TinyURL fallback) succeeds
			vi.mocked(fetch)
				.mockResolvedValueOnce({
					ok: false,
					status: 500
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					text: async () => 'https://tinyurl.com/fallback'
				} as Response);

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.shortUrl).toBe('https://tinyurl.com/fallback');
		});

		it('should fail when both providers fail', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'https://example.com' }, undefined, '9.9.9.9');

			// Both is.gd and TinyURL fail
			vi.mocked(fetch).mockResolvedValue({
				ok: false,
				status: 500
			} as Response);

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Internal server error');
		});
	});

	describe('Error Handling', () => {
		it('should handle malformed JSON gracefully', async () => {
			globalRateLimiter.reset('GLOBAL');
			const headers = new Headers();
			headers.set('origin', 'https://gridfinitylabels.com');
			headers.set('content-type', 'application/json');

			const context = {
				request: new Request('http://localhost/api/shorten', {
					method: 'POST',
					headers,
					body: 'invalid json{'
				}),
				getClientAddress: () => '10.10.10.10'
			};

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Internal server error');
		});

		it('should handle unexpected errors', async () => {
			globalRateLimiter.reset('GLOBAL');
			const context = createMockContext({ url: 'https://example.com' }, undefined, '11.11.11.11');

			vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

			const response = await POST(context as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Internal server error');
		});
	});
});
