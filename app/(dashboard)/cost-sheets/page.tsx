'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { getUser, type UserRole } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import { validateForm, validateRequired, type ValidationError } from '@/lib/form-validation';
import type { ProductCostSheet } from '@/types/product-cost-sheet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Product {
  id: string;
  name: string;
}

interface BatchOption {
  id: string;
  batchNumber: string;
  productId: string;
  productName?: string;
  status: string;
}

interface CostSheetFormData {
  productionBatchId: string;
  effectiveDate: string;
}

const EMPTY_FORM: CostSheetFormData = {
  productionBatchId: '',
  effectiveDate: '',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CostSheetsPage() {
  const { showToast } = useToast();
  const router = useRouter();

  // Auth
  const [role] = useState<UserRole | null>(() => getUser()?.role ?? null);
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [costSheets, setCostSheets] = useState<ProductCostSheet[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Products lookup (for display and filter)
  const [products, setProducts] = useState<Product[]>([]);

  // Filter
  const [productFilter, setProductFilter] = useState<string>('');

  // Completed batches for create modal
  const [completedBatches, setCompletedBatches] = useState<BatchOption[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CostSheetFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchCostSheets = useCallback(
    async (page = 1, productId = productFilter) => {
      setLoading(true);
      setError(null);

      let url = `/api/product-cost-sheets?page=${page}&limit=20`;
      if (productId) {
        url += `&productId=${productId}`;
      }

      const result = await apiClient.get<ProductCostSheet[]>(url);

      if (!result.success) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setCostSheets(result.data);

      if (result.pagination) {
        setPagination(result.pagination);
      }

      setLoading(false);
    },
    [productFilter]
  );

  const fetchProducts = useCallback(async () => {
    const result = await apiClient.get<Product[]>('/api/products');
    if (result.success) {
      setProducts(result.data);
    }
  }, []);

  const fetchCompletedBatches = useCallback(async () => {
    const result = await apiClient.get<BatchOption[]>('/api/production-batches?status=COMPLETED');
    if (result.success) {
      // Filter client-side for COMPLETED batches in case the API doesn't support the filter
      const completed = result.data.filter((b) => b.status === 'COMPLETED');
      setCompletedBatches(completed);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // On mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCostSheets(1);
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Filter handler
  // ---------------------------------------------------------------------------

  function handleProductFilterChange(value: string) {
    setProductFilter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCostSheets(1, value);
  }

  // ---------------------------------------------------------------------------
  // Modal handlers
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setValidationErrors([]);
    setModalOpen(true);
    fetchCompletedBatches();
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setValidationErrors([]);
  }

  function getFieldError(field: string): string | undefined {
    return validationErrors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation
    const errors = validateForm([
      validateRequired(form.productionBatchId, 'productionBatchId', 'Production batch'),
      validateRequired(form.effectiveDate, 'effectiveDate', 'Effective date'),
    ]);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setSubmitting(true);

    const payload = {
      productionBatchId: form.productionBatchId,
      effectiveDate: form.effectiveDate,
    };

    const result = await apiClient.post<ProductCostSheet>('/api/product-cost-sheets', payload);

    if (result.success) {
      showToast('Cost sheet created successfully', 'success');
      closeModal();
      fetchCostSheets(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Row click handler
  // ---------------------------------------------------------------------------

  function handleRowClick(id: string) {
    router.push(`/cost-sheets/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getProductName(productId: string): string {
    return products.find((p) => p.id === productId)?.name ?? '—';
  }

  function getBatchDisplayName(batch: BatchOption): string {
    const productName = batch.productName || getProductName(batch.productId);
    return `${batch.batchNumber} — ${productName}`;
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const columnCount = 5;

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100">
        {Array.from({ length: columnCount }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className="h-4 w-full rounded" />
          </td>
        ))}
      </tr>
    ));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Cost Sheets</h1>

        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Cost Sheet
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
        {/* Product filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-product" className="text-sm font-medium text-gray-600">
            Product:
          </label>
          <select
            id="filter-product"
            value={productFilter}
            onChange={(e) => handleProductFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table area */}
      <div className="overflow-x-auto" aria-busy={loading} aria-live="polite">
        {error ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchCostSheets(pagination.page)}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  SKU Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Cost / Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Effective Date
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : costSheets.length === 0 ? (
                /* Empty state */
                <tr>
                  <td colSpan={columnCount} className="px-4 py-16 text-center text-sm text-gray-500">
                    No cost sheets match the current filter criteria.
                  </td>
                </tr>
              ) : (
                costSheets.map((sheet) => (
                  <tr
                    key={sheet.id}
                    onClick={() => handleRowClick(sheet.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {getProductName(sheet.productId)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sheet.productItemId ? sheet.productItemId : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {parseFloat(sheet.totalManufacturingCostPerUnit).toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sheet.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(sheet.effectiveDate).toLocaleDateString()}
                    </td>
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
            onPageChange={(p) => fetchCostSheets(p)}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create Cost Sheet Modal                                             */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Create Cost Sheet"
      >
        <form onSubmit={handleSubmit} noValidate aria-label="Create cost sheet form">
          {/* Production Batch */}
          <div className="mb-4">
            <label htmlFor="costsheet-batch" className="block text-sm font-medium text-gray-700 mb-1">
              Production Batch <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            {completedBatches.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No completed batches available. A batch must be completed before a cost sheet can be created.
              </p>
            ) : (
              <select
                id="costsheet-batch"
                disabled={submitting}
                value={form.productionBatchId}
                onChange={(e) => setForm((f) => ({ ...f, productionBatchId: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                aria-required="true"
              >
                <option value="">Select a completed batch</option>
                {completedBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {getBatchDisplayName(batch)}
                  </option>
                ))}
              </select>
            )}
            {getFieldError('productionBatchId') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('productionBatchId')}</p>
            )}
          </div>

          {/* Effective Date */}
          <div className="mb-6">
            <label htmlFor="costsheet-date" className="block text-sm font-medium text-gray-700 mb-1">
              Effective Date <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="costsheet-date"
              type="date"
              disabled={submitting}
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              aria-required="true"
            />
            {getFieldError('effectiveDate') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('effectiveDate')}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || completedBatches.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg
                hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={submitting}
            >
              {submitting && (
                <span
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              {submitting ? 'Creating...' : 'Create Cost Sheet'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
