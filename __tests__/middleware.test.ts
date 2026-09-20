/**
 * Integration tests for middleware.ts
 *
 * Validates: Requirements 7.1–7.7, 8.1–8.4
 *
 * Tests the middleware function directly by mocking next/server
 * and verifying CORS + rate limiting behavior end-to-end.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Set env vars BEFORE any imports
process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_AUTH_MAX = "20";
process.env.RATE_LIMIT_AUTH_WINDOW_MS = "900000";
process.env.RATE_LIMIT_GENERAL_MAX = "100";
process.env.RATE_LIMIT_GENERAL_WINDOW_MS = "900000";

/**
 * Lightweight mock for Headers-like behavior.
 */
class MockHeaders {
  private store = new Map<string, string>();

  constructor(init?: Record<string, string>) {
    if (init) {
      for (const [k, v] of Object.entries(init)) {
        this.store.set(k.toLowerCase(), v);
      }
    }
  }

  get(key: string): string | null {
    return this.store.get(key.toLowerCase()) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key.toLowerCase(), value);
  }

  has(key: string): boolean {
    return this.store.has(key.toLowerCase());
  }

  delete(key: string): void {
    this.store.delete(key.toLowerCase());
  }
}

/**
 * Lightweight mock for NextRequest.
 */
class MockNextRequest {
  method: string;
  headers: MockHeaders;
  nextUrl: { pathname: string };

  constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
    this.method = init?.method || "GET";
    this.headers = new MockHeaders(init?.headers || {});
    const parsedUrl = new URL(url, "http://localhost:3000");
    this.nextUrl = { pathname: parsedUrl.pathname };
  }
}

/**
 * Lightweight mock for NextResponse.
 */
class MockNextResponse {
  status: number;
  body: unknown;
  headers: MockHeaders;

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new MockHeaders(init?.headers || {});
  }

  static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    const res = new MockNextResponse(data, init);
    return res;
  }

  static next() {
    return new MockNextResponse(null, { status: 200 });
  }
}

// Mock next/server at the top level
vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}));

function createRequest(
  path: string,
  options?: { method?: string; headers?: Record<string, string> }
): MockNextRequest {
  return new MockNextRequest(`http://localhost:3000${path}`, options);
}

describe("Middleware Integration Tests", () => {
  let middleware: (request: MockNextRequest) => MockNextResponse;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    // Re-set env vars after module reset
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000";
    process.env.RATE_LIMIT_AUTH_MAX = "20";
    process.env.RATE_LIMIT_AUTH_WINDOW_MS = "900000";
    process.env.RATE_LIMIT_GENERAL_MAX = "100";
    process.env.RATE_LIMIT_GENERAL_WINDOW_MS = "900000";

    const mod = await import("../middleware");
    middleware = mod.middleware as unknown as (request: MockNextRequest) => MockNextResponse;
  });

  describe("CORS Preflight (OPTIONS) Requests", () => {
    it("should return 204 with CORS headers and not consume rate limit", () => {
      const req = createRequest("/api/auth/login", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "192.168.1.1",
        },
      });

      const res = middleware(req);

      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-methods")).toBe(
        "GET, POST, PATCH, DELETE, OPTIONS"
      );
      expect(res.headers.get("access-control-allow-headers")).toBe(
        "Content-Type, Authorization, X-Requested-With"
      );
      expect(res.headers.get("access-control-max-age")).toBe("86400");
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:3000"
      );

      // Verify no rate limit was consumed — next request should have remaining = maxRequests - 1
      const nextReq = createRequest("/api/auth/login", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "192.168.1.1",
        },
      });
      const nextRes = middleware(nextReq);
      // If preflight didn't consume a slot, remaining should be 19 (max 20 - 1 for this request)
      expect(nextRes.headers.get("x-ratelimit-remaining")).toBe("19");
    });
  });

  describe("CORS Headers on Standard Responses", () => {
    it("should include CORS headers for allowed origin", () => {
      const req = createRequest("/api/products", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "10.0.0.1",
        },
      });

      const res = middleware(req);

      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:3000"
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
      expect(res.headers.get("access-control-expose-headers")).toBe(
        "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After"
      );
    });

    it("should omit CORS headers for disallowed origin but still allow request", () => {
      const req = createRequest("/api/products", {
        method: "GET",
        headers: {
          origin: "http://evil.com",
          "x-forwarded-for": "10.0.0.2",
        },
      });

      const res = middleware(req);

      // Request proceeds (not blocked)
      expect(res.status).toBe(200);
      // No CORS headers attached
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
      expect(res.headers.get("access-control-expose-headers")).toBeNull();
    });
  });

  describe("Rate Limit Headers", () => {
    it("should include rate limit headers on all API responses", () => {
      const req = createRequest("/api/products", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "10.0.0.3",
        },
      });

      const res = middleware(req);

      expect(res.headers.get("x-ratelimit-limit")).toBe("100");
      expect(res.headers.get("x-ratelimit-remaining")).toBe("99");
      expect(res.headers.get("x-ratelimit-reset")).not.toBeNull();
      // Reset should be a valid unix timestamp in seconds (in the future)
      const resetAt = parseInt(res.headers.get("x-ratelimit-reset")!);
      expect(resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe("Rate Limiting - Auth Tier (20 requests)", () => {
    it("should return 429 after exceeding auth tier limit of 20 requests", () => {
      const ip = "192.168.10.1";

      // Make 20 allowed requests
      for (let i = 0; i < 20; i++) {
        const req = createRequest("/api/auth/login", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "x-forwarded-for": ip,
          },
        });
        const res = middleware(req);
        expect(res.status).toBe(200);
      }

      // 21st request should be blocked
      const req = createRequest("/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": ip,
        },
      });
      const res = middleware(req);

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        message: "Too many requests. Please try again later.",
      });
      expect(res.headers.get("retry-after")).not.toBeNull();
      expect(parseInt(res.headers.get("retry-after")!)).toBeGreaterThan(0);
      expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    });
  });

  describe("Rate Limiting - General Tier (100 requests)", () => {
    it("should return 429 after exceeding general tier limit of 100 requests", () => {
      const ip = "192.168.20.1";

      // Make 100 allowed requests
      for (let i = 0; i < 100; i++) {
        const req = createRequest("/api/products", {
          method: "GET",
          headers: {
            origin: "http://localhost:3000",
            "x-forwarded-for": ip,
          },
        });
        const res = middleware(req);
        expect(res.status).toBe(200);
      }

      // 101st request should be blocked
      const req = createRequest("/api/products", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": ip,
        },
      });
      const res = middleware(req);

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        message: "Too many requests. Please try again later.",
      });
      expect(res.headers.get("retry-after")).not.toBeNull();
      expect(parseInt(res.headers.get("retry-after")!)).toBeGreaterThan(0);
      expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    });
  });

  describe("Tier Independence", () => {
    it("should have separate counters for auth and general tiers", () => {
      const ip = "192.168.30.1";

      // Make 15 auth requests
      for (let i = 0; i < 15; i++) {
        const req = createRequest("/api/auth/login", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "x-forwarded-for": ip,
          },
        });
        middleware(req);
      }

      // General tier should still have full quota (first request uses 1)
      const generalReq = createRequest("/api/products", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": ip,
        },
      });
      const generalRes = middleware(generalReq);

      expect(generalRes.status).toBe(200);
      expect(generalRes.headers.get("x-ratelimit-limit")).toBe("100");
      expect(generalRes.headers.get("x-ratelimit-remaining")).toBe("99");

      // Auth tier should reflect 16 used (15 prior + 1 more now)
      const authReq = createRequest("/api/auth/register", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": ip,
        },
      });
      const authRes = middleware(authReq);

      expect(authRes.status).toBe(200);
      expect(authRes.headers.get("x-ratelimit-limit")).toBe("20");
      expect(authRes.headers.get("x-ratelimit-remaining")).toBe("4");
    });
  });

  describe("Fail-Open Behavior", () => {
    it("should allow request to proceed when rate limiter throws", async () => {
      vi.resetModules();

      process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000";

      // Mock the rate limiter to throw
      vi.doMock("../lib/rate-limiter", () => {
        return {
          SlidingWindowRateLimiter: class {
            check(): never {
              throw new Error("Unexpected rate limiter failure");
            }
            destroy() {}
            cleanup() {}
            get size() {
              return 0;
            }
          },
        };
      });

      const mod = await import("../middleware");
      const failOpenMiddleware = mod.middleware as unknown as (
        request: MockNextRequest
      ) => MockNextResponse;

      const req = createRequest("/api/products", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "10.0.0.50",
        },
      });

      const res = failOpenMiddleware(req);

      // Should proceed (200) without crashing
      expect(res.status).toBe(200);
      // Fail-open means no rate limit headers attached
      expect(res.headers.get("x-ratelimit-limit")).toBeNull();
    });
  });

  describe("Coexistence with Per-Email Rate Limiter", () => {
    it("should use a separate store from the per-email rate limiter", async () => {
      // Ensure rate-limiter mock from fail-open test is cleared
      vi.resetModules();
      vi.doUnmock("../lib/rate-limiter");

      process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000";
      process.env.RATE_LIMIT_AUTH_MAX = "20";
      process.env.RATE_LIMIT_AUTH_WINDOW_MS = "900000";

      const mod = await import("../middleware");
      const mw = mod.middleware as unknown as (request: MockNextRequest) => MockNextResponse;

      // Import the per-email rate limiter (separate module with its own Map store)
      const { checkRateLimit, LOGIN_RATE_LIMIT } = await import(
        "../lib/rate-limit"
      );

      const ip = "10.0.0.100";

      // Make several requests through the middleware to build up IP-based counter
      for (let i = 0; i < 5; i++) {
        const req = createRequest("/api/auth/login", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "x-forwarded-for": ip,
          },
        });
        const res = mw(req);
        expect(res.status).toBe(200);
      }

      // Per-email limiter should be completely unaffected by middleware IP counter
      const emailResult = checkRateLimit("test@example.com", LOGIN_RATE_LIMIT);
      expect(emailResult.allowed).toBe(true);
      expect(emailResult.remaining).toBe(LOGIN_RATE_LIMIT.maxAttempts - 1);

      // Exhaust the per-email limiter for a different key
      for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts; i++) {
        checkRateLimit("exhaust@example.com", LOGIN_RATE_LIMIT);
      }
      const exhaustedResult = checkRateLimit(
        "exhaust@example.com",
        LOGIN_RATE_LIMIT
      );
      expect(exhaustedResult.allowed).toBe(false);

      // IP-based middleware limiter should still work fine — unaffected by per-email exhaustion
      const req = createRequest("/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": ip,
        },
      });
      const res = mw(req);
      expect(res.status).toBe(200);
      // Should show remaining as 14 (6 auth requests made from this IP: 5 above + this one)
      expect(res.headers.get("x-ratelimit-remaining")).toBe("14");
    });
  });
});
