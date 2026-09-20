/**
 * lib/auth.ts
 *
 * Client-side JWT helpers for the stock management frontend.
 * Uses only atob() and JSON.parse() — no external JWT library.
 * All functions that access localStorage are wrapped in try/catch
 * so they degrade gracefully in SSR / server contexts.
 */

const TOKEN_KEY = "stock_mgmt_token";
const REFRESH_TOKEN_KEY = "stock_mgmt_refresh";

export type UserRole = "OWNER" | "MANAGER" | "STAFF";

export interface AuthUser {
  userId: string;
  companyId: string;
  role: UserRole;
}

/** Internal: decoded JWT payload including standard claims. */
interface JwtPayload extends AuthUser {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------

/**
 * Read the JWT from localStorage.
 * Returns null when localStorage is unavailable (SSR) or the key is absent.
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Write the JWT to localStorage.
 * Silently no-ops when localStorage is unavailable (SSR).
 */
export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // SSR or storage blocked — intentionally ignored
  }
}

/**
 * Remove the JWT from localStorage.
 * Silently no-ops when localStorage is unavailable (SSR).
 */
export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // SSR or storage blocked — intentionally ignored
  }
}

/**
 * Read the refresh token from localStorage.
 */
export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Write the refresh token to localStorage.
 */
export function setRefreshToken(token: string): void {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // SSR or storage blocked
  }
}

// ---------------------------------------------------------------------------
// JWT decode helpers
// ---------------------------------------------------------------------------

/**
 * Decode the base64url payload segment of a JWT string.
 *
 * Steps:
 *   1. Split on '.'
 *   2. Take index 1 (the payload segment)
 *   3. Replace base64url characters: '-' → '+', '_' → '/'
 *   4. Pad to a multiple of 4 with '='
 *   5. atob() → JSON.parse()
 *
 * Returns null if any step throws or the result is not an object.
 */
function decodePayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    let base64 = parts[1];
    // Convert base64url to standard base64
    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
    // Pad to a multiple of 4
    const remainder = base64.length % 4;
    if (remainder !== 0) {
      base64 += "=".repeat(4 - remainder);
    }

    const decoded = atob(base64);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Decode the JWT currently stored in localStorage and return the
 * `userId`, `companyId`, and `role` fields.
 *
 * Returns null when:
 *  - No token is stored
 *  - The token is not a valid three-segment JWT
 *  - The payload is missing any of the required identity fields
 *  - Any decode step throws
 */
export function getUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;

  const payload = decodePayload(token);
  if (!payload) return null;

  const { userId, companyId, role } = payload;

  // Validate all required fields are present and are strings
  if (
    typeof userId !== "string" ||
    !userId ||
    typeof companyId !== "string" ||
    !companyId ||
    typeof role !== "string" ||
    !role
  ) {
    return null;
  }

  // Validate role is one of the known enum values
  if (role !== "OWNER" && role !== "MANAGER" && role !== "STAFF") {
    return null;
  }

  return { userId, companyId, role };
}

// ---------------------------------------------------------------------------
// Token validity check
// ---------------------------------------------------------------------------

/**
 * Returns true only when all of the following hold:
 *  - A token exists in localStorage
 *  - The token decodes to a valid payload with known identity fields
 *  - The payload contains an `exp` claim
 *  - The current time is before the expiry (exp * 1000 > Date.now())
 *
 * Returns false for expired, malformed, or missing tokens.
 */
export function isTokenValid(): boolean {
  const token = getToken();
  if (!token) return false;

  const payload = decodePayload(token);
  if (!payload) return false;

  // Must have a valid user shape
  const user = getUser();
  if (!user) return false;

  // Must have an exp claim and it must be in the future
  if (typeof payload.exp !== "number") return false;
  if (payload.exp * 1000 < Date.now()) return false;

  return true;
}
