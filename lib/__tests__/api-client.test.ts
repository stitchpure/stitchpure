/**
 * lib/__tests__/api-client.test.ts
 *
 * Property-based tests for lib/api-client.ts
 *
 * Properties tested:
 *   Property 1: Error responses produce a structured error object (Validates: Requirements 15.3)
 *   Property 2: 401 responses trigger logout and redirect     (Validates: Requirements 15.2)
 *   Property 3: Authorization header attached for any token   (Validates: Requirements 15.1)
 *
 * **Validates: Requirements 15.1, 15.2, 15.3**
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { apiClient } from "../api-client";
import * as auth from "../auth";

// ---------------------------------------------------------------------------
// Environment setup — polyfill localStorage for Node (same pattern as auth.test.ts)
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

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
// Polyfill window.location so the Node test environment supports href mutation
// ---------------------------------------------------------------------------

const locationObj = { href: "" };

Object.defineProperty(global, "window", {
  value: {
    location: locationObj,
  },
  writable: true,
});

// ---------------------------------------------------------------------------
// Shared setup: clear mocks and storage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
  locationObj.href = "";
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: build a minimal mock Response
// ---------------------------------------------------------------------------

function mockResponse(status: number, body: Record<string, unknown>): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ===========================================================================
// Property 1: Error responses produce a structured error object
// **Validates: Requirements 15.3**
// ===========================================================================

describe("Property 1 — Error responses produce a structured error object", () => {
  /**
   * For any non-2xx HTTP status code and any error message string returned by
   * the API, apiClient SHALL return { success: false, message: <that message> }.
   *
   * **Validates: Requirements 15.3**
   */
  it("property: non-2xx response returns { success: false, message: <api message> }", async () => {
    const errorStatusArb = fc.constantFrom(400, 403, 404, 409, 422, 500);
    const messageArb = fc.string({ minLength: 1 });

    await fc.assert(
      fc.asyncProperty(errorStatusArb, messageArb, async (status, message) => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue(mockResponse(status, { message }))
        );

        const result = await apiClient.get("/api/some-resource");

        expect(result.success).toBe(false);
        expect((result as { success: false; message: string }).message).toBe(
          message
        );
      }),
      { numRuns: 100 }
    );
  });

  it("property: non-2xx response without message field falls back to 'Request failed'", async () => {
    const errorStatusArb = fc.constantFrom(400, 403, 404, 409, 422, 500);

    await fc.assert(
      fc.asyncProperty(errorStatusArb, async (status) => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue(mockResponse(status, {}))
        );

        const result = await apiClient.get("/api/some-resource");

        expect(result.success).toBe(false);
        expect((result as { success: false; message: string }).message).toBe(
          "Request failed"
        );
      }),
      { numRuns: 50 }
    );
  });

  // --- Deterministic examples ---

  it("example: 400 response returns structured error with the API message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(400, { message: "Validation failed" })
      )
    );

    const result = await apiClient.get("/api/categories");
    expect(result).toEqual({ success: false, message: "Validation failed" });
  });

  it("example: 500 response returns structured error with the API message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(500, { message: "Internal server error" })
      )
    );

    const result = await apiClient.post("/api/products", { name: "test" });
    expect(result).toEqual({
      success: false,
      message: "Internal server error",
    });
  });

  it("example: network failure returns structured error with connection message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch"))
    );

    const result = await apiClient.get("/api/products");
    expect(result).toEqual({
      success: false,
      message: "Network error. Check your connection.",
    });
  });
});

// ===========================================================================
// Property 2: 401 responses trigger logout and redirect
// **Validates: Requirements 15.2**
// ===========================================================================

describe("Property 2 — 401 responses trigger logout and redirect", () => {
  /**
   * For any API endpoint path, when the server responds with HTTP 401,
   * apiClient SHALL remove the JWT from localStorage and set
   * window.location.href to '/login'.
   *
   * **Validates: Requirements 15.2**
   */
  it("property: 401 calls removeToken() and redirects to /login for any path", async () => {
    const pathArb = fc.string({ minLength: 1 });

    await fc.assert(
      fc.asyncProperty(pathArb, async (path) => {
        // Pre-store a token so we can confirm it gets removed
        auth.setToken("some-token");

        const removeTokenSpy = vi.spyOn(auth, "removeToken");

        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue(mockResponse(401, { message: "Unauthorized" }))
        );

        // Reset href to detect the change
        locationObj.href = "";

        await apiClient.get(path);

        expect(removeTokenSpy).toHaveBeenCalledOnce();
        expect(window.location.href).toBe("/login");

        vi.restoreAllMocks();
        localStorageMock.clear();
      }),
      { numRuns: 100 }
    );
  });

  it("property: 401 removes the token from localStorage for any path", async () => {
    const pathArb = fc.string({ minLength: 1 });

    await fc.assert(
      fc.asyncProperty(pathArb, async (path) => {
        auth.setToken("active-jwt-token");

        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue(mockResponse(401, {}))
        );

        await apiClient.get(path);

        expect(auth.getToken()).toBeNull();

        vi.restoreAllMocks();
        localStorageMock.clear();
      }),
      { numRuns: 100 }
    );
  });

  // --- Deterministic examples ---

  it("example: 401 on GET /api/categories redirects to /login", async () => {
    auth.setToken("eyJtest.payload.sig");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(401, { message: "Token expired" }))
    );

    await apiClient.get("/api/categories");

    expect(auth.getToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("example: 401 on POST /api/products redirects to /login", async () => {
    auth.setToken("eyJtest.payload.sig");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(401, { message: "Unauthorized" }))
    );

    await apiClient.post("/api/products", { name: "Widget" });

    expect(auth.getToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });
});

// ===========================================================================
// Property 3: Authorization header attached for any token
// **Validates: Requirements 15.1**
// ===========================================================================

describe("Property 3 — Authorization header attached for any token", () => {
  /**
   * For any non-empty JWT string stored in localStorage and any API path,
   * apiClient SHALL include an Authorization: Bearer <token> header in every
   * outbound request.
   *
   * **Validates: Requirements 15.1**
   */
  it("property: Authorization header is set to Bearer <token> for any non-empty token", async () => {
    const tokenArb = fc.string({ minLength: 1 });
    const pathArb = fc.string({ minLength: 1 });

    await fc.assert(
      fc.asyncProperty(tokenArb, pathArb, async (token, path) => {
        auth.setToken(token);

        let capturedHeaders: Record<string, string> = {};

        const fetchMock = vi.fn().mockImplementation(
          (_url: string, init: RequestInit) => {
            capturedHeaders = (init?.headers as Record<string, string>) ?? {};
            return Promise.resolve(mockResponse(200, { success: true, data: {} }));
          }
        );

        vi.stubGlobal("fetch", fetchMock);

        await apiClient.get(path);

        expect(capturedHeaders["Authorization"]).toBe(`Bearer ${token}`);

        vi.restoreAllMocks();
        localStorageMock.clear();
      }),
      { numRuns: 100 }
    );
  });

  it("property: Authorization header is attached for POST, PATCH, and DELETE too", async () => {
    const tokenArb = fc.string({ minLength: 1 });
    const methodArb = fc.constantFrom<"post" | "patch" | "delete">(
      "post",
      "patch",
      "delete"
    );

    await fc.assert(
      fc.asyncProperty(tokenArb, methodArb, async (token, method) => {
        auth.setToken(token);

        let capturedHeaders: Record<string, string> = {};

        const fetchMock = vi.fn().mockImplementation(
          (_url: string, init: RequestInit) => {
            capturedHeaders = (init?.headers as Record<string, string>) ?? {};
            return Promise.resolve(mockResponse(200, { success: true, data: {} }));
          }
        );

        vi.stubGlobal("fetch", fetchMock);

        if (method === "post") {
          await apiClient.post("/api/test", { data: "x" });
        } else if (method === "patch") {
          await apiClient.patch("/api/test", { data: "x" });
        } else {
          await apiClient.delete("/api/test");
        }

        expect(capturedHeaders["Authorization"]).toBe(`Bearer ${token}`);

        vi.restoreAllMocks();
        localStorageMock.clear();
      }),
      { numRuns: 100 }
    );
  });

  it("property: no Authorization header when localStorage has no token", async () => {
    const pathArb = fc.string({ minLength: 1 });

    await fc.assert(
      fc.asyncProperty(pathArb, async (path) => {
        // Ensure no token is set
        localStorageMock.clear();

        let capturedHeaders: Record<string, string> = {};

        const fetchMock = vi.fn().mockImplementation(
          (_url: string, init: RequestInit) => {
            capturedHeaders = (init?.headers as Record<string, string>) ?? {};
            return Promise.resolve(mockResponse(200, { success: true, data: {} }));
          }
        );

        vi.stubGlobal("fetch", fetchMock);

        await apiClient.get(path);

        expect(capturedHeaders["Authorization"]).toBeUndefined();

        vi.restoreAllMocks();
        localStorageMock.clear();
      }),
      { numRuns: 50 }
    );
  });

  // --- Deterministic examples ---

  it("example: GET with a token includes Bearer Authorization header", async () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.sig";
    auth.setToken(token);

    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) ?? {};
        return Promise.resolve(mockResponse(200, { success: true, data: [] }));
      })
    );

    await apiClient.get("/api/categories");

    expect(capturedHeaders["Authorization"]).toBe(`Bearer ${token}`);
  });

  it("example: POST with a token includes Bearer Authorization header and Content-Type", async () => {
    const token = "my-test-jwt-token";
    auth.setToken(token);

    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) ?? {};
        return Promise.resolve(
          mockResponse(201, { success: true, data: { id: "1" } })
        );
      })
    );

    await apiClient.post("/api/products", { name: "Widget" });

    expect(capturedHeaders["Authorization"]).toBe(`Bearer ${token}`);
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });
});
