# Implementation Plan: Rate Limiting & CORS

## Overview

Implement IP-based rate limiting and configurable CORS as a Next.js root middleware, using two utility modules (`lib/rate-limiter.ts` and `lib/cors.ts`) consumed by `middleware.ts`. The existing per-email rate limiter (`lib/rate-limit.ts`) remains unchanged.

## Tasks

- [x] 1. Create core interfaces, types, and CORS utility module
  - [x] 1.1 Create `lib/cors.ts` with CORS configuration parsing and header generation
    - Implement `CorsConfig` and `CorsHeaders` interfaces
    - Implement `parseCorsConfig(envValue)` — splits on comma, trims whitespace, filters empties, detects `*`
    - Implement `isOriginAllowed(origin, config)` — case-sensitive exact match or `allowAllOrigins`
    - Implement `getPreflightHeaders(origin, config)` — returns `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Max-Age`, and conditionally `Access-Control-Allow-Origin`
    - Implement `getResponseHeaders(origin, config)` — returns `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Access-Control-Expose-Headers` when origin is allowed; omits all when not allowed or no origin
    - _Requirements: 4.1–4.8, 5.1–5.5, 6.1–6.6_

  - [ ]* 1.2 Write property tests for CORS module (`__tests__/cors.property.test.ts`)
    - **Property 7: Allowed Origin Echo** — For any origin in the allowed list (or when allowAllOrigins), `Access-Control-Allow-Origin` is set to exactly that origin
    - **Validates: Requirements 4.2, 5.1, 6.4**
    - **Property 8: Disallowed Origin Omission** — For any origin NOT in the list (or null), CORS headers are omitted
    - **Validates: Requirements 4.6, 5.4, 5.5**
    - **Property 9: CORS Config Parsing Round-Trip Consistency** — parseCorsConfig produces exactly the non-empty trimmed entries
    - **Validates: Requirements 6.2, 6.6**
    - **Property 10: Case-Sensitive Origin Matching** — origin differing in case from all entries returns false
    - **Validates: Requirements 6.5**

  - [ ]* 1.3 Write unit tests for CORS module (`__tests__/cors.test.ts`)
    - Test `parseCorsConfig` with empty string, `*`, single origin, multiple origins, consecutive commas, whitespace
    - Test `getPreflightHeaders` returns correct headers for allowed/disallowed origins
    - Test `getResponseHeaders` includes credentials and expose-headers for allowed origins
    - Test that absent Origin header results in no CORS headers
    - _Requirements: 4.1–4.8, 5.1–5.5, 6.1–6.6_

- [x] 2. Implement rate limiter module
  - [x] 2.1 Create `lib/rate-limiter.ts` with `SlidingWindowRateLimiter` class
    - Implement `RateLimiterConfig`, `RateLimitEntry`, and `RateLimitResult` interfaces
    - Implement constructor that initializes Map store and starts cleanup interval
    - Implement `check(key)` — if entry exists and window active → increment; if expired → reset; if new → create; return `RateLimitResult`
    - Implement eviction logic — when store reaches `maxStoreSize`, evict entry with earliest `windowStart`
    - Implement `cleanup()` — iterate store and remove expired entries
    - Implement `destroy()` — clear the cleanup interval
    - Implement `size` getter for monitoring
    - _Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.5_

  - [ ]* 2.2 Write property tests for rate limiter (`__tests__/rate-limiter.property.test.ts`)
    - **Property 1: IP Extraction Priority Order** — Test the extraction utility function follows `x-forwarded-for` > `x-real-ip` > remote > `"unknown"` priority
    - **Validates: Requirements 1.1, 2.1**
    - **Property 2: Threshold Enforcement** — For maxRequests=N, requests 1..N allowed, request N+1 denied
    - **Validates: Requirements 1.2, 1.3, 2.3, 2.4**
    - **Property 3: Rate Limit Header Correctness** — After k requests, remaining = max - k, limit = max, resetAt computed correctly
    - **Validates: Requirements 1.6, 2.7**
    - **Property 4: Retry-After Correctness** — When denied, retryAfterSeconds is positive integer of seconds until window reset
    - **Validates: Requirements 1.4, 2.5**
    - **Property 5: Tier Independence** — Auth requests don't affect general count and vice versa
    - **Validates: Requirements 3.4**
    - **Property 6: Store Eviction Preserves Newest Entries** — On full store, oldest windowStart is evicted, new entry is stored
    - **Validates: Requirements 3.5**

  - [ ]* 2.3 Write unit tests for rate limiter (`__tests__/rate-limiter.test.ts`)
    - Test window creation on first request
    - Test counter increment within window
    - Test window reset after expiry
    - Test 429 response fields when limit exceeded
    - Test eviction removes oldest entry when store is full
    - Test cleanup removes expired entries
    - Test `destroy()` stops cleanup timer
    - _Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement root middleware and environment config
  - [x] 4.1 Create `middleware.ts` at project root
    - Import `SlidingWindowRateLimiter` and CORS utilities
    - Instantiate two rate limiter instances (auth tier: 20 req / 15 min, general tier: 100 req / 15 min)
    - Export `config` with matcher `["/api/:path*"]`
    - Implement `middleware(request)` function:
      - Wrap in try/catch for fail-open behavior
      - Detect OPTIONS → call `getPreflightHeaders`, return `NextResponse` with 204
      - Extract origin from request headers
      - Determine tier: path starts with `/api/auth` → auth, else → general
      - Extract client IP: `x-forwarded-for` (first IP before comma) → `x-real-ip` → `"unknown"`
      - Build composite key `${tier}:${ip}` and call `rateLimiter.check(key)`
      - If not allowed → return 429 JSON response with rate limit headers and Retry-After
      - If allowed → `NextResponse.next()` with CORS headers + rate limit headers attached
      - On catch → `NextResponse.next()` without additional headers (fail-open)
    - _Requirements: 7.1–7.7, 1.1–1.7, 2.1–2.7, 4.1–4.8, 5.1–5.5_

  - [x] 4.2 Add environment variables to `.env.local`
    - Add `CORS_ALLOWED_ORIGINS=http://localhost:3000` (default for local dev)
    - Add comments documenting optional `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AUTH_WINDOW_MS`, `RATE_LIMIT_GENERAL_MAX`, `RATE_LIMIT_GENERAL_WINDOW_MS` env vars
    - _Requirements: 6.1–6.3_

- [x] 5. Integration tests and final wiring
  - [x]* 5.1 Write integration tests for middleware (`__tests__/middleware.test.ts`)
    - Test preflight request returns 204 with correct CORS headers and no rate limit consumed
    - Test allowed origin receives CORS headers on standard response
    - Test disallowed origin receives no CORS headers but request proceeds
    - Test rate limit headers present on all API responses
    - Test 429 returned after exceeding auth tier limit (20 requests)
    - Test 429 returned after exceeding general tier limit (100 requests)
    - Test auth and general tiers are independent (separate counters)
    - Test fail-open behavior when rate limiter throws
    - Test coexistence: IP rate limiter uses separate store from existing per-email limiter
    - _Requirements: 7.1–7.7, 8.1–8.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `lib/rate-limit.ts` (per-email limiter) is NOT modified — coexistence is verified in integration tests
- All tests use Vitest + fast-check (already in devDependencies)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1"] }
  ]
}
```
