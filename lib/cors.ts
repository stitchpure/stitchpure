/**
 * CORS configuration parsing and header generation.
 *
 * Reads allowed origins from CORS_ALLOWED_ORIGINS env var and provides
 * utilities to generate appropriate CORS headers for preflight and
 * standard responses.
 */

export interface CorsConfig {
  allowedOrigins: string[]; // Parsed from env var
  allowAllOrigins: boolean; // True when CORS_ALLOWED_ORIGINS="*"
}

export interface CorsHeaders {
  headers: Record<string, string>;
  isAllowed: boolean;
}

// Constants for CORS header values
const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With";
const MAX_AGE = "86400";
const EXPOSE_HEADERS =
  "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After";

/**
 * Parse CORS_ALLOWED_ORIGINS env var into config.
 *
 * - Splits on comma, trims whitespace, filters empty strings
 * - Detects "*" wildcard to allow all origins
 * - Empty or undefined value means same-origin only (no cross-origin allowed)
 */
export function parseCorsConfig(envValue: string | undefined): CorsConfig {
  if (!envValue || envValue.trim() === "") {
    return { allowedOrigins: [], allowAllOrigins: false };
  }

  const trimmed = envValue.trim();

  if (trimmed === "*") {
    return { allowedOrigins: [], allowAllOrigins: true };
  }

  const origins = trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return { allowedOrigins: origins, allowAllOrigins: false };
}

/**
 * Check if an origin is allowed by the CORS config.
 *
 * - Returns false for null origin (no Origin header / same-origin)
 * - Returns true if allowAllOrigins is set
 * - Uses case-sensitive exact string matching against the allowed list
 */
export function isOriginAllowed(
  origin: string | null,
  config: CorsConfig
): boolean {
  if (origin === null) {
    return false;
  }

  if (config.allowAllOrigins) {
    return true;
  }

  return config.allowedOrigins.includes(origin);
}

/**
 * Generate CORS headers for a preflight (OPTIONS) response.
 *
 * Always includes: Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Max-Age.
 * Conditionally includes Access-Control-Allow-Origin only when the origin is allowed.
 */
export function getPreflightHeaders(
  origin: string | null,
  config: CorsConfig
): CorsHeaders {
  const allowed = isOriginAllowed(origin, config);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": MAX_AGE,
  };

  if (allowed && origin !== null) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return { headers, isAllowed: allowed };
}

/**
 * Generate CORS headers for a standard (non-preflight) response.
 *
 * When origin is allowed: includes Access-Control-Allow-Origin (set to the requesting origin),
 * Access-Control-Allow-Credentials, and Access-Control-Expose-Headers.
 *
 * When origin is not allowed or absent (null): returns empty headers object.
 */
export function getResponseHeaders(
  origin: string | null,
  config: CorsConfig
): CorsHeaders {
  const allowed = isOriginAllowed(origin, config);

  if (!allowed || origin === null) {
    return { headers: {}, isAllowed: false };
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": EXPOSE_HEADERS,
  };

  return { headers, isAllowed: true };
}
