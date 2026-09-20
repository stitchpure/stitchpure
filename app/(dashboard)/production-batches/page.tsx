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
import { validateForm, validateRequired, validateNumericRange, type ValidationError } from '@/lib/form-validation';
import type { ProductionBatchWithProduct } from '@/types/production-batch';

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

interface ProductItem {
  id: string;
  sku: string;
}

interface BatchFormData {
  productId: string;
  productItemId: string;
  plannedQuantity: string;
  startDate: string;
}

const EMPTY_FORM: BatchFormData = {
  productId: '',
  productItemId: '',
  plannedQuantity: '',
  startDate: '',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductionBatchesPage() {
  const { showToast } = useToast();
  const router = useRouter();

  // Auth
  const [role] = useState<UserRole | null>(() => getUser()?.role ?? null);

  // Data
  const [batches, setBatches] = useState<ProductionBatchWithProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<BatchFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Product/SKU dropdown state
  const [products, setProducts] = useState<Product[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<ProductionBatchWithProduct[]>(
      `/api/production-batches?page=${page}&limit=20`
    );

    if (!result.success) {
      setError(result.message);
      setLoading(false);
      return;
    }

    setBatches(result.data);

    if (result.pagination) {
      setPagination(result.pagination);
    }

    setLoading(false);
  }, []);

  // ---------------------------------------------------------------------------
  // On mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(1);
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Role helper
  // ---------------------------------------------------------------------------

  const canManage = role === 'OWNER' || role === 'MANAGER';

  // ---------------------------------------------------------------------------
  // Create Batch modal
  // ---------------------------------------------------------------------------

  async function openCreateModal() {
    setForm(EMPTY_FORM);
    setValidationErrors([]);
    setProductItems([]);
    setModalOpen(true);

    // Fetch products for dropdown
    const result = await apiClient.get<Product[]>('/api/products');
    if (result.success) {
      setProducts(result.data);
    }
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setValidationErrors([]);
    setProductItems([]);
  }

  async function handleProductChange(productId: string) {
    setForm((f) => ({ ...f, productId, productItemId: '' }));
    setProductItems([]);

    if (!productId) return;

    setLoadingItems(true);
    const result = await apiClient.get<ProductItem[]>(`/api/product-items?productId=${productId}`);
    if (result.success) {
      setProductItems(result.data);
    }
    setLoadingItems(false);
  }

  function getFieldError(field: string): string | undefined {
    return validationErrors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation
    const errors = validateForm([
      validateRequired(form.productId, 'productId', 'Product'),
      validateRequired(form.plannedQuantity, 'plannedQuantity', 'Planned quantity'),
      validateNumericRange(form.plannedQuantity, 'plannedQuantity', 'Planned quantity', 1, 999999),
      validateRequired(form.startDate, 'startDate', 'Start date'),
    ]);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setSubmitting(true);

    const payload = {
      productId: form.productId,
      productItemId: form.productItemId || null,
      plannedQuantity: parseInt(form.plannedQuantity),
      startDate: form.startDate,
    };

    const result = await apiClient.post<unknown>('/api/production-batches', payload);

    if (result.success) {
      showToast('Batch created successfully', 'success');
      closeModal();
      fetchData(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100">
        {Array.from({ length: 6 }).map((__, j) => (
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
        <h1 className="text-xl font-semibold text-gray-900">Production Batches</h1>

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
            Create Batch
          </button>
        )}
      </div>

      {/* Table area */}
      <div className="overflow-x-auto" aria-busy={loading} aria-live="polite">
        {error ? (
          /* Error state */
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Batch Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Planned Qty
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Good Qty
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : batches.length === 0 ? (
                /* Empty state */
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-500">
                    No production batches found.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr
                    key={batch.id}
                    onClick={() => router.push(`/production-batches/${batch.id}`)}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {batch.batchNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {batch.productName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {batch.plannedQuantity}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {batch.goodQuantity}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(batch.startDate).toLocaleDateString()}
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
            onPageChange={(p) => fetchData(p)}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create Batch Modal                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Create Batch"
      >
        <form onSubmit={handleSubmit} noValidate aria-label="Create batch form">
          {/* Product */}
          <div className="mb-4">
            <label htmlFor="batch-product" className="block text-sm font-medium text-gray-700 mb-1">
              Product <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="batch-product"
              disabled={submitting}
              value={form.productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              aria-required="true"
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {getFieldError('productId') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('productId')}</p>
            )}
          </div>

          {/* SKU / Product Item */}
          <div className="mb-4">
            <label htmlFor="batch-sku" className="block text-sm font-medium text-gray-700 mb-1">
              SKU <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <select
              id="batch-sku"
              disabled={submitting || !form.productId || loadingItems}
              value={form.productItemId}
              onChange={(e) => setForm((f) => ({ ...f, productItemId: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
            >
              {!form.productId ? (
                <option value="">Select a product first</option>
              ) : loadingItems ? (
                <option value="">Loading SKUs...</option>
              ) : productItems.length === 0 ? (
                <option value="" disabled>No SKUs available</option>
              ) : (
                <>
                  <option value="">Select a SKU</option>
                  {productItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Planned Quantity */}
          <div className="mb-4">
            <label htmlFor="batch-planned-qty" className="block text-sm font-medium text-gray-700 mb-1">
              Planned Quantity <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="batch-planned-qty"
              type="number"
              min={1}
              max={999999}
              step={1}
              disabled={submitting}
              value={form.plannedQuantity}
              onChange={(e) => setForm((f) => ({ ...f, plannedQuantity: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. 100"
              aria-required="true"
            />
            {getFieldError('plannedQuantity') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('plannedQuantity')}</p>
            )}
          </div>

          {/* Start Date */}
          <div className="mb-6">
            <label htmlFor="batch-start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="batch-start-date"
              type="date"
              disabled={submitting}
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              aria-required="true"
            />
            {getFieldError('startDate') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('startDate')}</p>
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
              disabled={submitting}
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
              {submitting ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
