import { NextRequest, NextResponse } from "next/server";
import { SlidingWindowRateLimiter } from "./lib/rate-limiter";
import { parseCorsConfig, getPreflightHeaders, getResponseHeaders } from "./lib/cors";

// Instantiate rate limiter instances at module level
const authRateLimiter = new SlidingWindowRateLimiter({
  maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "20"),
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || "900000"),
  maxStoreSize: 10000,
  cleanupIntervalMs: 300000,
});

const generalRateLimiter = new SlidingWindowRateLimiter({
  maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || "100"),
  windowMs: parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS || "900000"),
  maxStoreSize: 10000,
  cleanupIntervalMs: 300000,
});

// Parse CORS config at module level
const corsConfig = parseCorsConfig(process.env.CORS_ALLOWED_ORIGINS);

export const config = {
  matcher: ["/api/:path*"],
};

export function middleware(request: NextRequest): NextResponse {
  try {
    const origin = request.headers.get("origin");

    // Handle CORS preflight (OPTIONS) — return immediately without rate limiting
    if (request.method === "OPTIONS") {
      const preflightResult = getPreflightHeaders(origin, corsConfig);
      return new NextResponse(null, { status: 204, headers: preflightResult.headers });
    }

    // Determine tier and select appropriate rate limiter
    const isAuthEndpoint = request.nextUrl.pathname.startsWith("/api/auth");
    const tier = isAuthEndpoint ? "auth" : "general";
    const rateLimiter = isAuthEndpoint ? authRateLimiter : generalRateLimiter;

    // Extract client IP
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    let ip: string;

    if (forwardedFor) {
      ip = forwardedFor.split(",")[0].trim();
    } else if (realIp) {
      ip = realIp;
    } else {
      ip = "unknown";
    }

    // Build composite key and check rate limit
    const key = `${tier}:${ip}`;
    const result = rateLimiter.check(key);

    // Build rate limit headers
    const rateLimitHeaders: Record<string, string> = {
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.resetAt),
    };

    if (!result.allowed) {
      rateLimitHeaders["Retry-After"] = String(result.retryAfterSeconds);
    }

    // Get CORS headers for non-preflight responses
    const corsResult = getResponseHeaders(origin, corsConfig);
    const corsHeaders = corsResult.headers;

    // If rate limit exceeded, return 429
    if (!result.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429, headers: { ...rateLimitHeaders, ...corsHeaders } }
      );
    }

    // Request allowed — proceed with CORS + rate limit headers
    const response = NextResponse.next();

    for (const [headerName, headerValue] of Object.entries(corsHeaders)) {
      response.headers.set(headerName, headerValue);
    }

    for (const [headerName, headerValue] of Object.entries(rateLimitHeaders)) {
      response.headers.set(headerName, headerValue);
    }

    return response;
  } catch {
    // Fail-open: allow the request to proceed without additional headers
    return NextResponse.next();
  }
}
