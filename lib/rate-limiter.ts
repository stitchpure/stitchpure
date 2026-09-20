/**
 * Sliding Window Rate Limiter
 *
 * IP-based rate limiter for Next.js middleware with tiered limits
 * (auth vs general endpoints). Uses an in-memory Map store with
 * periodic cleanup and bounded size via oldest-entry eviction.
 *
 * This module is separate from `lib/rate-limit.ts` (per-email limiter)
 * to maintain independent stores and tracking keys.
 */

export interface RateLimiterConfig {
  /** Max requests allowed per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Max entries before eviction */
  maxStoreSize: number;
  /** Periodic cleanup interval in milliseconds */
  cleanupIntervalMs: number;
}

export interface RateLimitEntry {
  /** Number of requests made in the current window */
  count: number;
  /** Unix ms timestamp of when the window started */
  windowStart: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Maximum requests per window */
  limit: number;
  /** Requests remaining in the current window */
  remaining: number;
  /** Unix epoch seconds when the current window resets */
  resetAt: number;
  /** Seconds until the window resets (for Retry-After header) */
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private store: Map<string, RateLimitEntry>;
  private config: RateLimiterConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.store = new Map();
    this.cleanupTimer = null;

    if (typeof setInterval !== "undefined" && config.cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), config.cleanupIntervalMs);
      // Unref the timer so it doesn't prevent process exit in Node.js
      if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
        (this.cleanupTimer as NodeJS.Timeout).unref();
      }
    }
  }

  /**
   * Check and increment counter for a given key.
   * Key format is typically `${tier}:${clientIp}` (e.g., `auth:192.168.1.1`).
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (entry) {
      const windowEnd = entry.windowStart + this.config.windowMs;

      if (now < windowEnd) {
        // Window is still active — increment
        entry.count++;
        const allowed = entry.count <= this.config.maxRequests;
        return {
          allowed,
          limit: this.config.maxRequests,
          remaining: Math.max(0, this.config.maxRequests - entry.count),
          resetAt: Math.ceil(windowEnd / 1000),
          retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
        };
      } else {
        // Window expired — reset
        entry.count = 1;
        entry.windowStart = now;
        return {
          allowed: true,
          limit: this.config.maxRequests,
          remaining: this.config.maxRequests - 1,
          resetAt: Math.ceil((now + this.config.windowMs) / 1000),
          retryAfterSeconds: Math.ceil(this.config.windowMs / 1000),
        };
      }
    }

    // New entry — evict oldest if store is full
    if (this.store.size >= this.config.maxStoreSize) {
      this.evictOldest();
    }

    this.store.set(key, { count: 1, windowStart: now });

    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - 1,
      resetAt: Math.ceil((now + this.config.windowMs) / 1000),
      retryAfterSeconds: Math.ceil(this.config.windowMs / 1000),
    };
  }

  /** Remove all expired entries from the store. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.windowStart + this.config.windowMs) {
        this.store.delete(key);
      }
    }
  }

  /** Stop the cleanup interval (for testing and graceful shutdown). */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Current number of tracked entries (for monitoring). */
  get size(): number {
    return this.store.size;
  }

  /** Evict the entry with the earliest windowStart. */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestWindowStart = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.windowStart < oldestWindowStart) {
        oldestWindowStart = entry.windowStart;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.store.delete(oldestKey);
    }
  }
}
