/**
 * Pagination utility
 *
 * Provides helpers for parsing pagination query parameters and building
 * pagination metadata for list API responses.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

export type PaginationParams = {
  page: number;
  limit: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * Parse `page` and `limit` from URL search params.
 *
 * - `page` is clamped to a minimum of 1 (default: 1).
 * - `limit` is clamped between 1 and 100 inclusive (default: 20).
 * - Throws an Error with HTTP 400 status if either value is NaN after parsing.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (isNaN(rawPage) || isNaN(rawLimit)) {
    const error = new Error("Invalid pagination parameters");
    (error as any).statusCode = 400;
    throw error;
  }

  const page = Math.max(1, rawPage);
  const limit = Math.min(50, Math.max(1, rawLimit));

  return { page, limit };
}

/**
 * Build the pagination metadata object included in every list response.
 *
 * `totalPages` is computed as `Math.ceil(total / limit)`.
 * When `total` is 0, `totalPages` is 0.
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
  };
}
