'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';

import { getUser, type UserRole } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  stockLevel: number;
  optionValues: Array<{
    optionName: string;
    value: string;
  }>;
}

interface Product {
  id: string;
  name: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * SKUs overview (read-only).
 *
 * A global list of every SKU across all products with stock levels — useful
 * for spotting low/zero-stock items at a glance and jumping to the ledger.
 *
 * Creating, editing prices, adjusting stock and discontinuing now happen on the
 * product detail page (`/products/[id]`). Each row here links there via "Edit".
 */
export default function SKUsPage() {
  // Auth (role only affects whether the Edit shortcut is shown)
  const [role] = useState<UserRole | null>(() => getUser()?.role ?? null);

  const [items, setItems] = useState<ProductItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [filterProductId, setFilterProductId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = role === 'OWNER' || role === 'MANAGER';

  const fetchData = useCallback(
    async (
      page = 1,
      overrides?: { productId?: string; status?: string; search?: string },
    ) => {
      setLoading(true);
      setError(null);

      const pid = overrides?.productId ?? filterProductId;
      const st = overrides?.status ?? filterStatus;
      const q = overrides?.search ?? filterSearch;

      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (pid) params.set('productId', pid);
      if (st) params.set('status', st);
      if (q) params.set('search', q);

      const result = await apiClient.get<ProductItem[]>(
        `/api/product-items?${params.toString()}`,
      );

      if (!result.success || !('data' in result)) {
        setError(!result.success ? result.message : 'Unexpected response format');
        setLoading(false);
        return;
      }

      setItems(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
      setLoading(false);
    },
    [filterProductId, filterStatus, filterSearch],
  );

  const fetchProducts = useCallback(async () => {
    const result = await apiClient.get<Product[]>('/api/products?limit=500');
    if (result.success) setProducts(Array.isArray(result.data) ? result.data : []);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchData(1);
  }, [fetchData, fetchProducts]);

  function handleFilterProductChange(productId: string) {
    setFilterProductId(productId);
    setFilterSearch('');
    setSearchInput('');
    fetchData(1, { productId, status: filterStatus, search: '' });
  }

  function handleFilterStatusChange(status: string) {
    setFilterStatus(status);
    fetchData(1, { productId: filterProductId, status, search: filterSearch });
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setFilterSearch(searchInput);
    fetchData(1, { productId: filterProductId, status: filterStatus, search: searchInput });
  }

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100">
        {Array.from({ length: canManage ? 7 : 6 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className="h-4 w-full rounded" />
          </td>
        ))}
      </tr>
    ));
  }

  const colSpan = canManage ? 7 : 6;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">SKUs</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Overview of all SKUs and stock. Add or edit from a product&apos;s page.
          </p>
        </div>
        {canManage && (
          <Link
            href="/catalog/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Catalog
          </Link>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label htmlFor="filter-product" className="text-xs font-medium text-gray-600">
            Product
          </label>
          <select
            id="filter-product"
            value={filterProductId}
            onChange={(e) => handleFilterProductChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[160px]">
          <label htmlFor="filter-status" className="text-xs font-medium text-gray-600">
            Status
          </label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => handleFilterStatusChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-search" className="text-xs font-medium text-gray-600">
              Search
            </label>
            <input
              id="filter-search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="SKU, barcode…"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchData(pagination.page)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Selling Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ledger</th>
                {canManage && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-16 text-center text-sm text-gray-500">
                    No SKUs found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.sku}
                      {item.optionValues.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.optionValues.map((ov) => `${ov.optionName}: ${ov.value}`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.productName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">₹{parseFloat(item.sellingPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{item.stockLevel}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/stock-ledger?productItemId=${item.id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                      >
                        View Ledger
                      </Link>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <Link
                          href={`/products/${item.productId}`}
                          className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md
                            hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                        >
                          Edit
                        </Link>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => fetchData(p)}
          />
        </div>
      )}
    </div>
  );
}
