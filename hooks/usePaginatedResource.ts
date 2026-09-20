'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UsePaginatedResourceOptions {
  /** Build the API URL for a given page/limit. Keep stable (useCallback) when derived from filters. */
  buildUrl: (page: number, limit: number) => string;
  limit?: number;
  /** When false, skips the initial fetch (e.g. waiting on auth). */
  enabled?: boolean;
  initialPage?: number;
}

/**
 * Shared list-page pattern: loading/error/pagination + apiClient.get.
 * Pages keep their own create/edit/delete UI; this only covers the list fetch.
 */
export function usePaginatedResource<T>(options: UsePaginatedResourceOptions) {
  const {
    buildUrl,
    limit = 10,
    enabled = true,
    initialPage = 1,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: initialPage,
    limit,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);

      const result = await apiClient.get<T[]>(buildUrl(page, limit));

      if (result.success && 'data' in result) {
        setData(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        } else {
          setPagination((prev) => ({ ...prev, page, limit }));
        }
      } else {
        setError(result.message);
      }

      setLoading(false);
    },
    [buildUrl, limit]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchPage(initialPage);
  }, [enabled, fetchPage, initialPage]);

  const refetch = useCallback(() => {
    return fetchPage(pagination.page);
  }, [fetchPage, pagination.page]);

  return {
    data,
    setData,
    pagination,
    setPagination,
    loading,
    error,
    setError,
    fetchPage,
    refetch,
  };
}
