# Requirements Document

## Introduction

This feature adds comprehensive rate limiting and CORS security middleware to the stock management application. The application currently has a per-email rate limiter on the login endpoint only. This feature extends rate limiting to all API endpoints with tiered limits (stricter for auth, relaxed for general API), and adds configurable CORS headers to support future mobile and external client access.

## Glossary

- **Rate_Limiter**: The in-memory middleware component that tracks and enforces request limits per client identifier within a configured time window
- **CORS_Handler**: The middleware component that evaluates cross-origin requests against an allowed origins list and attaches appropriate CORS response headers
- **Auth_Endpoint**: Any API route under `/api/auth/*` (login, register, refresh)
- **General_Endpoint**: Any API route under `/api/*` that is not an Auth_Endpoint
- **Client_Identifier**: The IP address extracted from request headers (`x-forwarded-for`, `x-real-ip`, or connection remote address) used to identify a unique client for rate limiting
- **Sliding_Window**: A rate limiting strategy where the time window resets from the first request in the current window
- **Preflight_Request**: An HTTP OPTIONS request sent by browsers before cross-origin requests to check CORS policy
- **Allowed_Origin**: A domain explicitly configured as permitted to make cross-origin requests to the API

## Requirements

### Requirement 1: IP-Based Rate Limiting for Auth Endpoints

**User Story:** As a system administrator, I want auth endpoints to have strict rate limiting by IP address, so that brute force and credential stuffing attacks are throttled at the API level.

#### Acceptance Criteria

1. WHEN a request is made to an Auth_Endpoint, THE Rate_Limiter SHALL identify the client by extracting the Client_Identifier from request headers in the following priority order: the first IP from `x-forwarded-for` (leftmost value before any comma), then `x-real-ip`, then the connection remote address
2. WHILE the request count from a Client_Identifier to Auth_Endpoints has not exceeded 20 requests within a 15-minute Sliding_Window, THE Rate_Limiter SHALL allow the request to proceed
3. WHEN the request count from a Client_Identifier exceeds 20 requests within a 15-minute window to Auth_Endpoints, THE Rate_Limiter SHALL respond with HTTP status 429 (Too Many Requests)
4. WHEN a 429 response is returned, THE Rate_Limiter SHALL include a `Retry-After` header containing the number of seconds until the window resets
5. WHEN a 429 response is returned, THE Rate_Limiter SHALL include a JSON response body with `{ "success": false, "message": "Too many requests. Please try again later." }`
6. THE Rate_Limiter SHALL include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on all responses to Auth_Endpoints, where `X-RateLimit-Limit` contains the maximum request count (20), `X-RateLimit-Remaining` contains the number of requests left in the current window, and `X-RateLimit-Reset` contains the Unix timestamp (in seconds) when the current window expires
7. IF no Client_Identifier can be extracted from any of the supported headers, THEN THE Rate_Limiter SHALL treat the request as a single shared anonymous client and apply the same 20-request per 15-minute window limit using a fixed fallback identifier

### Requirement 2: IP-Based Rate Limiting for General API Endpoints

**User Story:** As a system administrator, I want general API endpoints to have rate limiting by IP address, so that no single client can overwhelm the server with excessive requests.

#### Acceptance Criteria

1. WHEN a request is made to a General_Endpoint, THE Rate_Limiter SHALL identify the client using the Client_Identifier extracted from request headers in priority order: `x-forwarded-for` (first IP in the list), then `x-real-ip`, then connection remote address
2. IF the Client_Identifier cannot be determined from any request header or connection information, THEN THE Rate_Limiter SHALL treat the request as originating from a single shared "unknown" identifier and apply the same rate limits
3. WHILE the request count from a Client_Identifier to General_Endpoints has not exceeded 100 requests within a 15-minute Sliding_Window, THE Rate_Limiter SHALL allow the request to proceed to the route handler
4. WHEN the request count from a Client_Identifier exceeds 100 requests within a 15-minute window to General_Endpoints, THE Rate_Limiter SHALL respond with HTTP status 429 (Too Many Requests)
5. WHEN a 429 response is returned for a General_Endpoint, THE Rate_Limiter SHALL include a `Retry-After` header containing the number of whole seconds (integer) remaining until the current Sliding_Window resets
6. WHEN a 429 response is returned for a General_Endpoint, THE Rate_Limiter SHALL include a JSON response body with `{ "success": false, "message": "Too many requests. Please try again later." }`
7. THE Rate_Limiter SHALL include the following headers on all responses to General_Endpoints: `X-RateLimit-Limit` set to the maximum number of allowed requests (100), `X-RateLimit-Remaining` set to the number of requests remaining in the current window (integer, minimum 0), and `X-RateLimit-Reset` set to the Unix epoch timestamp (in seconds) at which the current Sliding_Window resets

### Requirement 3: Rate Limiter Memory Management

**User Story:** As a system administrator, I want the in-memory rate limiter to clean up expired entries automatically, so that memory usage remains bounded over time.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL store request counts in an in-memory data structure (Map) keyed by a composite of Client_Identifier and endpoint tier (auth or general)
2. WHEN a Sliding_Window expires for a Client_Identifier (more than 15 minutes have elapsed since the window start), THE Rate_Limiter SHALL remove that entry from the store on the next access or periodic cleanup
3. THE Rate_Limiter SHALL run a periodic cleanup interval every 5 minutes, independent of incoming requests, to iterate and remove all entries whose window has expired
4. THE Rate_Limiter SHALL separate the rate limit counters for Auth_Endpoints and General_Endpoints (a client has independent quotas for each tier)
5. THE Rate_Limiter SHALL enforce a maximum store size of 10,000 entries; WHEN this limit is reached and a new entry must be created, THE Rate_Limiter SHALL evict the oldest entry (earliest window start) before inserting the new one

### Requirement 4: CORS Preflight Handling

**User Story:** As a frontend developer integrating from an external origin, I want the API to properly handle CORS preflight requests, so that browsers allow my cross-origin API calls.

#### Acceptance Criteria

1. WHEN a Preflight_Request (OPTIONS method) is received on any `/api/*` route, THE CORS_Handler SHALL respond with HTTP status 204 (No Content) and an empty response body
2. WHEN a Preflight_Request is received from an Allowed_Origin, THE CORS_Handler SHALL include an `Access-Control-Allow-Origin` header set to the requesting origin
3. WHEN a Preflight_Request is received, THE CORS_Handler SHALL include an `Access-Control-Allow-Methods` header containing `GET, POST, PATCH, DELETE, OPTIONS` regardless of whether the requesting origin is in the Allowed_Origin list
4. WHEN a Preflight_Request is received, THE CORS_Handler SHALL include an `Access-Control-Allow-Headers` header containing `Content-Type, Authorization, X-Requested-With` regardless of whether the requesting origin is in the Allowed_Origin list
5. WHEN a Preflight_Request is received, THE CORS_Handler SHALL include an `Access-Control-Max-Age` header set to `86400` (24 hours)
6. WHEN a Preflight_Request is received from an origin not in the Allowed_Origin list, THE CORS_Handler SHALL omit the `Access-Control-Allow-Origin` header from the response
7. IF a Preflight_Request includes an `Access-Control-Request-Method` header specifying a method not listed in the `Access-Control-Allow-Methods` response header, THEN THE CORS_Handler SHALL still respond with HTTP status 204 and the standard allowed methods list (the browser will enforce the mismatch)
8. IF a Preflight_Request includes an `Access-Control-Request-Headers` header specifying a header not listed in the `Access-Control-Allow-Headers` response header, THEN THE CORS_Handler SHALL still respond with HTTP status 204 and the standard allowed headers list (the browser will enforce the mismatch)

### Requirement 5: CORS Headers on Standard Responses

**User Story:** As a frontend developer integrating from an external origin, I want all API responses to include proper CORS headers, so that my browser-based application can read the response data.

#### Acceptance Criteria

1. WHEN a non-preflight request is received from an Allowed_Origin, THE CORS_Handler SHALL include an `Access-Control-Allow-Origin` header set to the requesting origin
2. WHEN a non-preflight request is received from an Allowed_Origin, THE CORS_Handler SHALL include an `Access-Control-Allow-Credentials` header set to `true`
3. WHEN a non-preflight request is received from an Allowed_Origin, THE CORS_Handler SHALL include an `Access-Control-Expose-Headers` header listing `X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After`
4. WHEN a non-preflight request is received from an origin not in the Allowed_Origin list, THE CORS_Handler SHALL omit the `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, and `Access-Control-Expose-Headers` headers from the response and allow the request to continue to the route handler
5. IF a non-preflight request contains no Origin header (same-origin request), THEN THE CORS_Handler SHALL not add `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, or `Access-Control-Expose-Headers` headers to the response

### Requirement 6: CORS Configuration

**User Story:** As a system administrator, I want the CORS allowed origins list to be configurable via environment variables, so that I can manage allowed clients without code changes.

#### Acceptance Criteria

1. THE CORS_Handler SHALL read allowed origins from the `CORS_ALLOWED_ORIGINS` environment variable at application startup
2. WHEN the `CORS_ALLOWED_ORIGINS` environment variable contains a comma-separated list of origins, THE CORS_Handler SHALL treat each entry as an Allowed_Origin after trimming whitespace
3. WHEN the `CORS_ALLOWED_ORIGINS` environment variable is not set or is empty, THE CORS_Handler SHALL default to allowing only same-origin requests (no cross-origin allowed)
4. WHEN `CORS_ALLOWED_ORIGINS` contains the value `*`, THE CORS_Handler SHALL allow all origins and set `Access-Control-Allow-Origin` to the requesting origin (not the literal `*`) to remain compatible with `Access-Control-Allow-Credentials: true`
5. THE CORS_Handler SHALL compare the request `Origin` header against the Allowed_Origin list using case-sensitive exact string matching (origins include scheme, host, and port if non-default)
6. WHEN `CORS_ALLOWED_ORIGINS` contains empty entries resulting from consecutive commas (e.g., `http://a.com,,http://b.com`), THE CORS_Handler SHALL ignore empty entries after trimming

### Requirement 7: Middleware Integration with Next.js

**User Story:** As a developer, I want rate limiting and CORS to be applied via Next.js middleware.ts at the edge, so that protection is applied before route handlers execute.

#### Acceptance Criteria

1. THE Rate_Limiter and CORS_Handler SHALL be implemented in a Next.js `middleware.ts` file at the project root
2. THE middleware SHALL export a `config` object with a `matcher` pattern that matches all routes under `/api/*` and excludes non-API routes
3. THE middleware SHALL apply CORS handling before rate limiting evaluation
4. WHEN the middleware processes a Preflight_Request, THE middleware SHALL return the CORS preflight response without applying rate limiting
5. WHEN the middleware allows a request to proceed, THE middleware SHALL attach CORS headers and rate limit headers to the response via `NextResponse.next()` with modified headers
6. THE middleware SHALL not execute for routes outside the `/api/*` matcher pattern, ensuring frontend pages, static assets, and Next.js internal routes (e.g., `_next/static`, `_next/image`) are unaffected
7. IF the middleware encounters an unexpected error during CORS or rate limit processing, THEN THE middleware SHALL allow the request to proceed to the route handler without CORS or rate limit headers (fail-open behavior)

### Requirement 8: Rate Limiting Compatibility with Existing Per-Email Limiter

**User Story:** As a developer, I want the new IP-based rate limiter to coexist with the existing per-email login rate limiter, so that both layers of protection are active simultaneously.

#### Acceptance Criteria

1. THE Rate_Limiter middleware SHALL use a separate in-memory store and separate tracking keys from the existing `checkRateLimit` function, such that incrementing the IP-based counter does not affect the per-email counter and vice versa
2. WHEN a login request passes the IP-based Rate_Limiter, THE login route handler SHALL still apply the existing per-email rate limit check
3. IF the IP-based Rate_Limiter rejects a request before it reaches the route handler, THEN THE Rate_Limiter middleware SHALL return a 429 response with the middleware response format and the per-email rate limit check SHALL not execute
4. IF a login request passes the IP-based Rate_Limiter but the per-email rate limiter rejects it, THEN THE login route handler SHALL return a 429 response with the route handler's own response format including a `Retry-After` header
