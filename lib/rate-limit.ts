/**
 * Simple in-memory rate limiter.
 * For production at scale, use Redis-based rate limiting.
 *
 * Tracks attempts per key (IP or email) within a time window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Maximum attempts allowed within the window */
  maxAttempts: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g., IP address, email)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining attempts
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window expired — allow and start fresh
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxAttempts - 1, resetAt };
  }

  // Within window — check count
  if (entry.count >= config.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment and allow
  entry.count++;
  store.set(key, entry);
  return { allowed: true, remaining: config.maxAttempts - entry.count, resetAt: entry.resetAt };
}

/**
 * Login rate limit: 10 attempts per 5 minutes per email.
 * This is a safety net — the DB-level lockout (5 attempts → 30 min lock) is the primary protection.
 */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Register rate limit: 3 attempts per hour per IP.
 */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
};
