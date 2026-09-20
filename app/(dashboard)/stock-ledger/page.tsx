'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Skeleton from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LedgerEntry {
  id: string;
  companyId: string;
  productItemId: string;
  movementType: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  referenceType: string | null;
  referenceId: string | null;
  quantityChange: number;
  quantityAfter: number;
  notes: string | null;
  createdAt: string;
}

interface ProductItem {
  id: string;
  sku: string;
  productName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  stockLevel: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Movement type badge
// ---------------------------------------------------------------------------

const MOVEMENT_CLASSES: Record<string, string> = {
  PURCHASE: 'bg-green-100 text-green-800',
  SALE: 'bg-red-100 text-red-800',
  ADJUSTMENT: 'bg-gray-100 text-gray-800',
};

function MovementBadge({ type }: { type: string }) {
  const colorClasses = MOVEMENT_CLASSES[type] ?? 'bg-gray-100 text-gray-800';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function StockLedgerContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // Auth
  const [_role, setRole] = useState<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF');

  // SKU selector state (used when no query param)
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [productItemsLoading, setProductItemsLoading] = useState(false);
  const [selectedProductItemId, setSelectedProductItemId] = useState<string>('');

  // Ledger data
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The productItemId currently being viewed (from query param or dropdown selection)
  const [activeProductItemId, setActiveProductItemId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch ledger entries
  // ---------------------------------------------------------------------------

  async function fetchLedger(productItemId: string, page: number) {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<LedgerEntry[]>(
      `/api/stock-ledger?productItemId=${productItemId}&page=${page}&limit=20`
    );

    if (result.success && 'data' in result) {
      setEntries(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } else {
      setError(result.message);
      showToast(result.message, 'error');
    }

    setLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Fetch product items for SKU dropdown
  // ---------------------------------------------------------------------------

  async function fetchProductItems() {
    setProductItemsLoading(true);

    const result = await apiClient.get<ProductItem[]>('/api/product-items?limit=500');

    if (result.success && 'data' in result && Array.isArray(result.data)) {
      setProductItems(result.data as ProductItem[]);
    } else if (result.success && 'data' in result) {
      // data arrived but wasn't an array — defensive fallback
      setProductItems([]);
    } else {
      setProductItems([]);
      showToast('Failed to load SKUs: ' + (result as { message: string }).message, 'error');
    }

    setProductItemsLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const user = getUser();
    if (user) {
      setRole(user.role);
    }

    const paramId = searchParams.get('productItemId');

    if (paramId) {
      // Query param present — immediately fetch ledger for that SKU
      setActiveProductItemId(paramId);
      fetchLedger(paramId, 1);
    } else {
      // No query param — load SKU dropdown
      fetchProductItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSkuChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedProductItemId(id);
    if (id) {
      setActiveProductItemId(id);
      setEntries([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
      fetchLedger(id, 1);
    } else {
      setActiveProductItemId(null);
      setEntries([]);
    }
  }

  function handlePageChange(page: number) {
    if (activeProductItemId) {
      fetchLedger(activeProductItemId, page);
    }
  }

  function handleRetry() {
    if (activeProductItemId) {
      fetchLedger(activeProductItemId, pagination.page);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatQtyChange(qty: number): string {
    return qty > 0 ? `+${qty}` : String(qty);
  }

  function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasQueryParam = searchParams.get('productItemId') !== null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Stock Ledger</h1>
        </div>

        <div className="p-6">
          {/* SKU selector — only shown when no query param provided */}
          {!hasQueryParam && (
            <div className="mb-6">
              <label
                htmlFor="sku-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Select SKU
              </label>
              {productItemsLoading ? (
                <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
              ) : (
                <select
                  id="sku-select"
                  value={selectedProductItemId}
                  onChange={handleSkuChange}
                  className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">— Select a SKU —</option>
                  {Array.isArray(productItems) && productItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.productName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* No SKU selected yet and no query param */}
          {!activeProductItemId && !hasQueryParam && !productItemsLoading && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">
                Select a SKU above to view its stock ledger.
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex gap-4">
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && activeProductItemId && entries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">
                No ledger entries found for this SKU.
              </p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && entries.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Movement Type
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Qty Change
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Qty After
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Reference Type
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <MovementBadge type={entry.movementType} />
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-medium ${
                            entry.quantityChange > 0
                              ? 'text-green-700'
                              : entry.quantityChange < 0
                              ? 'text-red-700'
                              : 'text-gray-600'
                          }`}
                        >
                          {formatQtyChange(entry.quantityChange)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {entry.quantityAfter}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.referenceType ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner component in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function StockLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center px-6 py-4 border-b border-gray-200">
              <div className="h-7 w-40 animate-pulse bg-gray-200 rounded" />
            </div>
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex gap-4">
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                  <Skeleton className="h-10 w-1/5 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <StockLedgerContent />
    </Suspense>
  );
}
