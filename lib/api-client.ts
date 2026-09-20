/**
 * lib/api-client.ts
 *
 * Centralized fetch wrapper for the stock management frontend.
 *
 * Responsibilities:
 *  1. Attaches Authorization: Bearer <token> when a JWT is present in localStorage
 *  2. Sets Content-Type: application/json for mutations (POST / PATCH)
 *  3. On 401: clears the JWT and redirects to /login
 *  4. On non-2xx: returns { success: false, message: <api message> }
 *  5. On network failure: returns { success: false, message: 'Network error. Check your connection.' }
 *  6. On 2xx: returns the parsed JSON response as-is
 */

import { getToken, removeToken, getRefreshToken, setToken } from "./auth";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  // Attach Authorization header when a token is present
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Set Content-Type for mutations
  const method = (options.method ?? "GET").toUpperCase();
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  let data: unknown;

  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    return { success: false, message: "Network error. Check your connection." };
  }

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  // 401 — attempt token refresh before redirecting
  if (response.status === 401) {
    const isAuthEndpoint = path.startsWith("/api/auth/");

    // Don't refresh for auth endpoints themselves
    if (!isAuthEndpoint) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const refreshResponse = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.data?.token) {
              // Save new access token and retry original request
              setToken(refreshData.data.token);
              headers["Authorization"] = `Bearer ${refreshData.data.token}`;
              const retryResponse = await fetch(path, { ...options, headers });
              const retryData = await retryResponse.json().catch(() => ({}));
              if (retryResponse.ok) {
                return retryData as ApiResult<T>;
              }
            }
          }
        } catch {
          // Refresh failed — fall through to logout
        }
      }

      // Refresh failed or no refresh token — logout
      removeToken();
      window.location.href = "/login";
    }

    const message =
      (data as Record<string, unknown>)?.message as string | undefined;
    return { success: false, message: message || "Unauthorized" };
  }

  // Non-2xx — return structured error
  if (!response.ok) {
    const message =
      (data as Record<string, unknown>)?.message as string | undefined;
    return {
      success: false,
      message: message || "Request failed",
    };
  }

  // 2xx — return the parsed JSON as-is
  return data as ApiResult<T>;
}

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

export const apiClient = {
  get<T>(path: string): Promise<ApiResult<T>> {
    return apiRequest<T>(path, { method: "GET" });
  },

  post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return apiRequest<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return apiRequest<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  patch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return apiRequest<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string): Promise<ApiResult<T>> {
    return apiRequest<T>(path, { method: "DELETE" });
  },
};
