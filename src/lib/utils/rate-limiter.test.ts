import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, type RateLimitResult } from './rate-limiter';

describe('RateLimiter', () => {
	let rateLimiter: RateLimiter;

	beforeEach(() => {
		// Create a new instance with 3 requests per 1000ms window
		rateLimiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
	});

	describe('check', () => {
		it('should allow requests within limit', () => {
			const result1 = rateLimiter.check('user1');
			const result2 = rateLimiter.check('user1');
			const result3 = rateLimiter.check('user1');

			expect(result1.allowed).toBe(true);
			expect(result2.allowed).toBe(true);
			expect(result3.allowed).toBe(true);
			expect(result3.remaining).toBe(0);
		});

		it('should block requests exceeding limit', () => {
			rateLimiter.check('user1');
			rateLimiter.check('user1');
			rateLimiter.check('user1');

			const result4 = rateLimiter.check('user1');

			expect(result4.allowed).toBe(false);
			expect(result4.remaining).toBe(0);
		});

		it('should track different identifiers separately', () => {
			rateLimiter.check('user1');
			rateLimiter.check('user1');
			rateLimiter.check('user1');

			const user2Result = rateLimiter.check('user2');

			expect(user2Result.allowed).toBe(true);
			expect(user2Result.remaining).toBe(2);
		});

		it('should return retry-after time when blocked', () => {
			rateLimiter.check('user1');
			rateLimiter.check('user1');
			rateLimiter.check('user1');

			const result = rateLimiter.check('user1');

			expect(result.allowed).toBe(false);
			expect(result.retryAfter).toBeGreaterThan(0);
			expect(result.retryAfter).toBeLessThanOrEqual(1000);
		});

		it('should reset after time window expires', async () => {
			// Use fake timers
			vi.useFakeTimers();

			rateLimiter.check('user1');
			rateLimiter.check('user1');
			rateLimiter.check('user1');

			// Fourth request should be blocked
			expect(rateLimiter.check('user1').allowed).toBe(false);

			// Advance time by window duration
			vi.advanceTimersByTime(1001);

			// Should allow requests again
			const result = rateLimiter.check('user1');
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(2);

			vi.useRealTimers();
		});

		it('should handle rapid successive requests correctly', () => {
			const results: RateLimitResult[] = [];

			for (let i = 0; i < 5; i++) {
				results.push(rateLimiter.check('user1'));
			}

			expect(results[0].allowed).toBe(true);
			expect(results[1].allowed).toBe(true);
			expect(results[2].allowed).toBe(true);
			expect(results[3].allowed).toBe(false);
			expect(results[4].allowed).toBe(false);
		});

		it('should correctly calculate remaining requests', () => {
			const result1 = rateLimiter.check('user1');
			expect(result1.remaining).toBe(2);

			const result2 = rateLimiter.check('user1');
			expect(result2.remaining).toBe(1);

			const result3 = rateLimiter.check('user1');
			expect(result3.remaining).toBe(0);
		});

		it('should handle empty identifier', () => {
			const result = rateLimiter.check('');
			expect(result.allowed).toBe(true);
		});

		it('should clean up old entries automatically', () => {
			vi.useFakeTimers();

			// Create many identifiers
			for (let i = 0; i < 100; i++) {
				rateLimiter.check(`user${i}`);
			}

			// Advance time to expire all entries
			vi.advanceTimersByTime(1001);

			// Trigger cleanup by checking a new user
			rateLimiter.check('newuser');

			// Old entries should be cleaned (internal state test)
			// We can verify by checking that old users get fresh limits
			const oldUserResult = rateLimiter.check('user1');
			expect(oldUserResult.remaining).toBe(2); // Fresh limit

			vi.useRealTimers();
		});
	});

	describe('reset', () => {
		it('should reset limits for specific identifier', () => {
			rateLimiter.check('user1');
			rateLimiter.check('user1');
			rateLimiter.check('user1');

			expect(rateLimiter.check('user1').allowed).toBe(false);

			rateLimiter.reset('user1');

			const result = rateLimiter.check('user1');
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(2);
		});

		it('should not affect other identifiers when resetting', () => {
			rateLimiter.check('user1');
			rateLimiter.check('user2');

			rateLimiter.reset('user1');

			const user2Result = rateLimiter.check('user2');
			expect(user2Result.remaining).toBe(1); // Still has used one
		});
	});

	describe('custom configuration', () => {
		it('should respect custom max requests', () => {
			const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

			for (let i = 0; i < 5; i++) {
				expect(limiter.check('user1').allowed).toBe(true);
			}

			expect(limiter.check('user1').allowed).toBe(false);
		});

		it('should respect custom window duration', () => {
			vi.useFakeTimers();

			const limiter = new RateLimiter({ maxRequests: 1, windowMs: 500 });

			limiter.check('user1');
			expect(limiter.check('user1').allowed).toBe(false);

			vi.advanceTimersByTime(501);

			expect(limiter.check('user1').allowed).toBe(true);

			vi.useRealTimers();
		});
	});
});
