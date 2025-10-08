/**
 * Simple In-Memory Rate Limiter
 *
 * Implements sliding window rate limiting without external dependencies.
 * Suitable for single-instance deployments.
 */

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfter?: number; // seconds until reset
}

export interface RateLimiterConfig {
	maxRequests: number; // Maximum requests per window
	windowMs: number; // Time window in milliseconds
}

interface RequestRecord {
	count: number;
	resetAt: number; // timestamp when window resets
}

export class RateLimiter {
	private readonly maxRequests: number;
	private readonly windowMs: number;
	private readonly store: Map<string, RequestRecord> = new Map();
	private cleanupIntervalId?: ReturnType<typeof setInterval>;

	constructor(config: RateLimiterConfig) {
		this.maxRequests = config.maxRequests;
		this.windowMs = config.windowMs;

		// Periodic cleanup of expired entries
		this.cleanupIntervalId = setInterval(() => this.cleanup(), this.windowMs);
	}

	/**
	 * Check if a request from the given identifier is allowed
	 * @param identifier - Unique identifier (e.g., IP address)
	 * @returns Rate limit result with allowed status and remaining quota
	 */
	check(identifier: string): RateLimitResult {
		const now = Date.now();
		const record = this.store.get(identifier);

		// No record or expired window - allow and create new record
		if (!record || now >= record.resetAt) {
			this.store.set(identifier, {
				count: 1,
				resetAt: now + this.windowMs
			});

			return {
				allowed: true,
				remaining: this.maxRequests - 1
			};
		}

		// Within window - check if limit exceeded
		if (record.count >= this.maxRequests) {
			const retryAfter = Math.ceil((record.resetAt - now) / 1000);

			return {
				allowed: false,
				remaining: 0,
				retryAfter
			};
		}

		// Increment counter
		record.count++;
		this.store.set(identifier, record);

		return {
			allowed: true,
			remaining: this.maxRequests - record.count
		};
	}

	/**
	 * Reset rate limit for a specific identifier
	 * @param identifier - Unique identifier to reset
	 */
	reset(identifier: string): void {
		this.store.delete(identifier);
	}

	/**
	 * Clean up expired entries from the store
	 */
	private cleanup(): void {
		const now = Date.now();

		for (const [identifier, record] of this.store.entries()) {
			if (now >= record.resetAt) {
				this.store.delete(identifier);
			}
		}
	}

	/**
	 * Destroy the rate limiter and clean up resources
	 */
	destroy(): void {
		if (this.cleanupIntervalId) {
			clearInterval(this.cleanupIntervalId);
		}
		this.store.clear();
	}
}
