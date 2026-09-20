"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import ProductGrid from "./ProductGrid";
import StorefrontSearch from "./StorefrontSearch";
import ProductFilterSidebar from "./ProductFilterSidebar";
import StorefrontPagination from "./StorefrontPagination";
import EmptyState from "./EmptyState";
import LoadingGrid from "./LoadingGrid";
import type {
  StorefrontCategory,
  StorefrontPagination as PaginationMeta,
  StorefrontProduct,
} from "@/types/storefront";

interface StorefrontClientProps {
  initialProducts: StorefrontProduct[];
  initialPagination: PaginationMeta;
  initialCategories: StorefrontCategory[];
  initialSearch: string;
  initialCategoryIds: string[];
  initialMinPrice: string;
  initialMaxPrice: string;
  initialError?: string | null;
}

export default function StorefrontClient({
  initialProducts,
  initialPagination,
  initialCategories,
  initialSearch,
  initialCategoryIds,
  initialMinPrice,
  initialMaxPrice,
  initialError = null,
}: StorefrontClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState(initialPagination);
  const [categories, setCategories] = useState(initialCategories);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const skipNextFetchRef = useRef(true);
  const searchParamsRef = useRef(searchParams);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const searchRaw = searchParams.get("search") ?? "";
  const search =
    searchRaw.trim().length >= 3 ? searchRaw.trim() : "";
  const categoryIds = (searchParams.get("categoryIds") ?? "")
    .split(",")
    .filter(Boolean);
  const categoryIdsKey = categoryIds.join(",");
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const pageParam = searchParams.get("page");
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    },
    [pathname, router]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({
        search: value || null,
        page: "1",
      });
    },
    [updateParams]
  );

  const handleFiltersApply = useCallback(
    (filters: {
      categoryIds: string[];
      minPrice: string;
      maxPrice: string;
    }) => {
      updateParams({
        categoryIds:
          filters.categoryIds.length > 0
            ? filters.categoryIds.join(",")
            : null,
        categoryId: null,
        minPrice: filters.minPrice || null,
        maxPrice: filters.maxPrice || null,
        page: "1",
      });
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      updateParams({ page: String(nextPage) });
    },
    [updateParams]
  );

  useEffect(() => {
    // Use SSR data on first mount — don't refetch immediately
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      const isInitial =
        search === initialSearch &&
        categoryIdsKey === initialCategoryIds.join(",") &&
        minPrice === initialMinPrice &&
        maxPrice === initialMaxPrice &&
        page === initialPagination.page;
      if (isInitial) return;
    }

    const controller = new AbortController();

    async function fetchProducts() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        includeCategories: "true",
      });
      if (search) params.set("search", search);
      if (categoryIdsKey) params.set("categoryIds", categoryIdsKey);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      try {
        const res = await fetch(`/api/storefront/products?${params}`, {
          signal: controller.signal,
        });
        const json = await res.json();

        if (controller.signal.aborted) return;

        if (!res.ok || !json.success) {
          setError(json.message ?? "Failed to load products");
          setProducts([]);
          setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
          return;
        }

        setProducts(json.data);
        setPagination(json.pagination);
        if (json.categories) {
          setCategories(json.categories);
        }

        if (
          json.pagination.totalPages > 0 &&
          page > json.pagination.totalPages
        ) {
          updateParams({ page: "1" });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to load products");
        setProducts([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchProducts();
    return () => controller.abort();
  }, [
    search,
    categoryIdsKey,
    minPrice,
    maxPrice,
    page,
    initialSearch,
    initialCategoryIds,
    initialMinPrice,
    initialMaxPrice,
    initialPagination.page,
    updateParams,
  ]);

  const showLoading = loading || isPending;
  const hasFilters = Boolean(
    search || categoryIds.length > 0 || minPrice || maxPrice
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <ProductFilterSidebar
        key={`${categoryIdsKey}:${minPrice}:${maxPrice}`}
        categories={categories}
        categoryIds={categoryIds}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onApply={handleFiltersApply}
      />

      <div className="min-w-0 space-y-7">
        <div className="sf-surface sf-card-shadow p-3 sm:p-3.5">
          <StorefrontSearch
            value={search || initialSearch}
            onChange={handleSearchChange}
          />
        </div>

        {error ? (
        <div className="rounded-[var(--sf-radius)] border border-red-200/80 bg-red-50/80 px-4 py-6 text-center text-sm text-red-700">
          {error}
        </div>
      ) : showLoading ? (
        <LoadingGrid />
      ) : products.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? "No products were found for your filters."
              : "No products are currently available."
          }
          hint={
            hasFilters
              ? "Try adjusting or clearing your search and category filters."
              : "New drops are on the way — check back soon."
          }
        />
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm font-semibold uppercase tracking-wide text-[var(--sf-soft)]">
              {pagination.total} {pagination.total === 1 ? "item" : "items"}
            </span>
          </div>
          <ProductGrid products={products} />
          <StorefrontPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onChange={handlePageChange}
          />
        </>
      )}
      </div>
    </div>
  );
}
