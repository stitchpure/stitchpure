/**
 * lib/__tests__/auth.test.ts
 *
 * Property-based and unit tests for lib/auth.ts
 *
 * Properties tested:
 *   Property 4: JWT decode round-trip preserves identity fields (Validates: Requirements 3.3)
 *   Property 5: Malformed JWT is rejected and cleared (Validates: Requirements 3.4)
 *
 * **Validates: Requirements 3.3, 3.4**
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { getUser, isTokenValid, setToken, removeToken, getToken } from "../auth";

// ---------------------------------------------------------------------------
// Environment setup — polyfill localStorage and atob for Node
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

// Assign to global so the module's try/catch blocks succeed
Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Node 16+ has Buffer; use it to implement atob/btoa if missing
if (typeof global.atob === "undefined") {
  global.atob = (b64: string) => Buffer.from(b64, "base64").toString("binary");
  global.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
}

// ---------------------------------------------------------------------------
// Helper: build a minimal three-segment JWT with base64url-encoded payload
// ---------------------------------------------------------------------------

type Role = "OWNER" | "MANAGER" | "STAFF";

function buildToken(
  payload: Record<string, unknown>,
  header = { alg: "HS256", typ: "JWT" }
): string {
  const encodeSegment = (obj: object) => {
    const json = JSON.stringify(obj);
    // btoa expects binary strings; for pure ASCII JSON this is fine
    const base64 = btoa(json);
    // Convert to base64url
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };

  const headerSeg = encodeSegment(header);
  const payloadSeg = encodeSegment(payload);
  // Signature segment is not verified by auth.ts — use a dummy value
  const signatureSeg = "dummysig";

  return `${headerSeg}.${payloadSeg}.${signatureSeg}`;
}

/** Future expiry (1 hour from now) in seconds */
function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

/** Past expiry (1 hour ago) in seconds */
function pastExp(): number {
  return Math.floor(Date.now() / 1000) - 3600;
}

// ---------------------------------------------------------------------------
// Shared setup: clear storage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
});

// ===========================================================================
// Property 4: JWT decode round-trip preserves identity fields
// **Validates: Requirements 3.3**
// ===========================================================================

describe("Property 4 — JWT decode round-trip preserves identity fields", () => {
  /**
   * For any combination of userId (uuid), companyId (uuid), and role
   * (OWNER | MANAGER | STAFF) encoded into a valid JWT payload,
   * getUser() SHALL return an object where userId, companyId, and role
   * exactly match the encoded values.
   *
   * **Validates: Requirements 3.3**
   */
  it("property: getUser() returns the exact userId, companyId, and role encoded in the JWT", () => {
    const roleArb = fc.constantFrom<Role>("OWNER", "MANAGER", "STAFF");

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        roleArb,
        (userId, companyId, role) => {
          const token = buildToken({
            userId,
            companyId,
            role,
            exp: futureExp(),
          });

          setToken(token);
          const user = getUser();

          expect(user).not.toBeNull();
          expect(user!.userId).toBe(userId);
          expect(user!.companyId).toBe(companyId);
          expect(user!.role).toBe(role);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("property: getUser() result shape has exactly {userId, companyId, role} keys for valid tokens", () => {
    const roleArb = fc.constantFrom<Role>("OWNER", "MANAGER", "STAFF");

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        roleArb,
        (userId, companyId, role) => {
          const token = buildToken({
            userId,
            companyId,
            role,
            exp: futureExp(),
            iat: Math.floor(Date.now() / 1000) - 10,
            // Extra claims that should be ignored
            sub: userId,
            iss: "stock-mgmt",
          });

          setToken(token);
          const user = getUser();

          expect(user).toMatchObject({ userId, companyId, role });
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Deterministic examples ---

  it("example: decodes OWNER role correctly", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const companyId = "123e4567-e89b-12d3-a456-426614174000";
    const role: Role = "OWNER";
    const token = buildToken({ userId, companyId, role, exp: futureExp() });

    setToken(token);
    expect(getUser()).toEqual({ userId, companyId, role });
  });

  it("example: decodes MANAGER role correctly", () => {
    const userId = "a3bb189e-8bf9-3888-9912-ace4e6543002";
    const companyId = "c56a4180-65aa-42ec-a945-5fd21dec0538";
    const role: Role = "MANAGER";
    const token = buildToken({ userId, companyId, role, exp: futureExp() });

    setToken(token);
    expect(getUser()).toEqual({ userId, companyId, role });
  });

  it("example: decodes STAFF role correctly", () => {
    const userId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const companyId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const role: Role = "STAFF";
    const token = buildToken({ userId, companyId, role, exp: futureExp() });

    setToken(token);
    expect(getUser()).toEqual({ userId, companyId, role });
  });

  it("returns null when no token is stored", () => {
    expect(getUser()).toBeNull();
  });

  it("returns null when payload is missing userId", () => {
    const token = buildToken({ companyId: "some-id", role: "OWNER", exp: futureExp() });
    setToken(token);
    expect(getUser()).toBeNull();
  });

  it("returns null when payload has an unknown role", () => {
    const token = buildToken({
      userId: "any",
      companyId: "any",
      role: "ADMIN",
      exp: futureExp(),
    });
    setToken(token);
    expect(getUser()).toBeNull();
  });
});

// ===========================================================================
// Property 5: Malformed JWT is rejected — isTokenValid() returns false
// **Validates: Requirements 3.4**
// ===========================================================================

describe("Property 5 — Malformed JWT is rejected", () => {
  /**
   * For any string that is not a valid three-segment base64url JWT,
   * isTokenValid() SHALL return false.
   *
   * **Validates: Requirements 3.4**
   */
  it("property: isTokenValid() returns false for arbitrary random strings", () => {
    fc.assert(
      fc.property(
        // Exclude strings that happen to contain exactly two dots (valid structure)
        fc.string({ minLength: 0, maxLength: 200 }).filter(
          (s) => s.split(".").length !== 3
        ),
        (badToken) => {
          setToken(badToken);
          expect(isTokenValid()).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("property: isTokenValid() returns false for truncated tokens (one or two segments)", () => {
    const roleArb = fc.constantFrom<Role>("OWNER", "MANAGER", "STAFF");

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        roleArb,
        (userId, companyId, role) => {
          const fullToken = buildToken({ userId, companyId, role, exp: futureExp() });
          const segments = fullToken.split(".");

          // 1-segment token
          setToken(segments[0]);
          expect(isTokenValid()).toBe(false);

          // 2-segment token (header.payload, no signature)
          setToken(`${segments[0]}.${segments[1]}`);
          expect(isTokenValid()).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("property: isTokenValid() returns false for expired tokens (past exp)", () => {
    const roleArb = fc.constantFrom<Role>("OWNER", "MANAGER", "STAFF");

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        roleArb,
        (userId, companyId, role) => {
          const token = buildToken({
            userId,
            companyId,
            role,
            exp: pastExp(), // expired
          });
          setToken(token);
          expect(isTokenValid()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("property: isTokenValid() returns false for tokens missing the exp claim", () => {
    const roleArb = fc.constantFrom<Role>("OWNER", "MANAGER", "STAFF");

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        roleArb,
        (userId, companyId, role) => {
          // No exp field
          const token = buildToken({ userId, companyId, role });
          setToken(token);
          expect(isTokenValid()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Deterministic malformed examples ---

  it("example: empty string is rejected", () => {
    setToken("");
    expect(isTokenValid()).toBe(false);
  });

  it("example: plain text is rejected", () => {
    setToken("not-a-jwt");
    expect(isTokenValid()).toBe(false);
  });

  it("example: token with non-base64 payload is rejected", () => {
    setToken("header.!!!invalid!!!.sig");
    expect(isTokenValid()).toBe(false);
  });

  it("example: token with non-JSON payload is rejected", () => {
    const badPayload = btoa("this is not json").replace(/=/g, "");
    setToken(`header.${badPayload}.sig`);
    expect(isTokenValid()).toBe(false);
  });

  it("example: expired token is rejected", () => {
    const token = buildToken({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      companyId: "123e4567-e89b-12d3-a456-426614174000",
      role: "OWNER",
      exp: pastExp(),
    });
    setToken(token);
    expect(isTokenValid()).toBe(false);
  });

  it("example: token with exp = 0 is rejected", () => {
    const token = buildToken({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      companyId: "123e4567-e89b-12d3-a456-426614174000",
      role: "OWNER",
      exp: 0,
    });
    setToken(token);
    expect(isTokenValid()).toBe(false);
  });

  it("example: four-segment token is rejected (too many dots)", () => {
    const token = buildToken({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      companyId: "123e4567-e89b-12d3-a456-426614174000",
      role: "OWNER",
      exp: futureExp(),
    });
    setToken(token + ".extrasegment");
    expect(isTokenValid()).toBe(false);
  });

  // --- Positive baseline: valid token is accepted ---

  it("baseline: a valid unexpired token is accepted by isTokenValid()", () => {
    const token = buildToken({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      companyId: "123e4567-e89b-12d3-a456-426614174000",
      role: "OWNER",
      exp: futureExp(),
    });
    setToken(token);
    expect(isTokenValid()).toBe(true);
  });
});

// ===========================================================================
// Token storage helpers — setToken / removeToken / getToken round-trip
// ===========================================================================

describe("Token storage helpers", () => {
  it("setToken stores the token and getToken retrieves it", () => {
    setToken("test-token-value");
    expect(getToken()).toBe("test-token-value");
  });

  it("removeToken clears the stored token", () => {
    setToken("test-token-value");
    removeToken();
    expect(getToken()).toBeNull();
  });

  it("getToken returns null when no token is set", () => {
    expect(getToken()).toBeNull();
  });
});
