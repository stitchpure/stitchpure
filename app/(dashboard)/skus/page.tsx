'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';

import { getUser, type UserRole } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  weight: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  stockLevel: number;
  optionValues: Array<{
    optionId: string;
    optionName: string;
    optionSlug: string;
    optionValueId: string;
    value: string;
    code: string | null;
    colorCode: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  isActive: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  type: 'TEXT' | 'COLOR' | 'NUMBER';
}

interface OptionValue {
  id: string;
  value: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Create form data
interface CreateFormData {
  productId: string;
  sku: string;
  barcode: string;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  weight: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  optionSelections: Record<string, string>; // optionId -> optionValueId
}

// Edit form data (no optionValues)
interface EditFormData {
  sku: string;
  barcode: string;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  weight: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
}

const EMPTY_CREATE_FORM: CreateFormData = {
  productId: '',
  sku: '',
  barcode: '',
  purchasePrice: '',
  sellingPrice: '',
  mrp: '',
  weight: '',
  status: 'ACTIVE',
  optionSelections: {},
};

const EMPTY_EDIT_FORM: EditFormData = {
  sku: '',
  barcode: '',
  purchasePrice: '',
  sellingPrice: '',
  mrp: '',
  weight: '',
  status: 'ACTIVE',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SKUsPage() {
  const { showToast } = useToast();

  // Auth
  const [role, setRole] = useState<UserRole | null>(null);

  // Data
  const [items, setItems] = useState<ProductItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filter state
  const [filterProductId, setFilterProductId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormData>(EMPTY_CREATE_FORM);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionValuesMap, setOptionValuesMap] = useState<Record<string, OptionValue[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>(EMPTY_EDIT_FORM);

  // Confirm dialog (discontinue)
  const [confirmTarget, setConfirmTarget] = useState<ProductItem | null>(null);
  const [discontinuing, setDiscontinuing] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(
    async (page = 1, overrides?: { productId?: string; status?: string; search?: string }) => {
      setLoading(true);
      setError(null);

      const pid = overrides?.productId ?? filterProductId;
      const st = overrides?.status ?? filterStatus;
      const q = overrides?.search ?? filterSearch;

      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (pid) params.set('productId', pid);
      if (st) params.set('status', st);
      if (q) params.set('search', q);

      const result = await apiClient.get<ProductItem[]>(`/api/product-items?${params.toString()}`);

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

  // ---------------------------------------------------------------------------
  // On mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const user = getUser();
    setRole(user?.role ?? null);
    fetchProducts();
    fetchData(1);
  }, [fetchData, fetchProducts]);

  // ---------------------------------------------------------------------------
  // Role helper
  // ---------------------------------------------------------------------------

  const canManage = role === 'OWNER' || role === 'MANAGER';

  // ---------------------------------------------------------------------------
  // Filter handlers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Create modal
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setCreateForm(EMPTY_CREATE_FORM);
    setProductOptions([]);
    setOptionValuesMap({});
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreateModalOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setProductOptions([]);
    setOptionValuesMap({});
  }

  async function handleCreateProductIdChange(productId: string) {
    setCreateForm((f) => ({ ...f, productId, optionSelections: {} }));
    setProductOptions([]);
    setOptionValuesMap({});
    if (!productId) return;

    setLoadingOptions(true);
    const optResult = await apiClient.get<ProductOption[]>(`/api/products/${productId}/options`);
    if (!optResult.success) {
      setLoadingOptions(false);
      return;
    }
    const opts = optResult.data;
    setProductOptions(opts);

    const valMap: Record<string, OptionValue[]> = {};
    await Promise.all(
      opts.map(async (opt) => {
        const valResult = await apiClient.get<OptionValue[]>(
          `/api/products/${productId}/options/${opt.id}/values`,
        );
        if (valResult.success) valMap[opt.id] = valResult.data;
      }),
    );
    setOptionValuesMap(valMap);
    setLoadingOptions(false);
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const optionValues = Object.entries(createForm.optionSelections)
      .filter(([, valueId]) => valueId)
      .map(([optionId, optionValueId]) => ({ optionId, optionValueId }));

    const payload = {
      productId: createForm.productId,
      sku: createForm.sku.trim(),
      ...(createForm.barcode.trim() ? { barcode: createForm.barcode.trim() } : {}),
      purchasePrice: parseFloat(createForm.purchasePrice),
      sellingPrice: parseFloat(createForm.sellingPrice),
      mrp: parseFloat(createForm.mrp),
      ...(createForm.weight.trim() ? { weight: parseFloat(createForm.weight) } : {}),
      status: createForm.status,
      optionValues,
    };

    const result = await apiClient.post<ProductItem>('/api/product-items', payload);

    if (result.success) {
      showToast('SKU created successfully', 'success');
      closeCreateModal();
      fetchData(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Edit modal
  // ---------------------------------------------------------------------------

  function openEditModal(item: ProductItem) {
    setEditingItem(item);
    setEditForm({
      sku: item.sku,
      barcode: item.barcode ?? '',
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      mrp: item.mrp,
      weight: item.weight ?? '',
      status: item.status,
    });
    setEditModalOpen(true);
  }

  function closeEditModal() {
    if (submitting) return;
    setEditModalOpen(false);
    setEditingItem(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !editingItem) return;
    setSubmitting(true);

    const payload = {
      sku: editForm.sku.trim(),
      ...(editForm.barcode.trim() ? { barcode: editForm.barcode.trim() } : { barcode: null }),
      purchasePrice: parseFloat(editForm.purchasePrice),
      sellingPrice: parseFloat(editForm.sellingPrice),
      mrp: parseFloat(editForm.mrp),
      ...(editForm.weight.trim() ? { weight: parseFloat(editForm.weight) } : { weight: null }),
      status: editForm.status,
    };

    const result = await apiClient.patch<ProductItem>(
      `/api/product-items/${editingItem.id}`,
      payload,
    );

    if (result.success) {
      showToast('SKU updated successfully', 'success');
      closeEditModal();
      fetchData(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Discontinue
  // ---------------------------------------------------------------------------

  function openDiscontinueDialog(item: ProductItem) {
    setConfirmTarget(item);
  }

  function closeDiscontinueDialog() {
    if (discontinuing) return;
    setConfirmTarget(null);
  }

  async function handleDiscontinue() {
    if (!confirmTarget || discontinuing) return;
    setDiscontinuing(true);

    const result = await apiClient.delete<unknown>(`/api/product-items/${confirmTarget.id}`);

    if (result.success) {
      showToast('SKU discontinued successfully', 'success');
      setConfirmTarget(null);
      fetchData(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setDiscontinuing(false);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100">
        {Array.from({ length: 7 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className="h-4 w-full rounded" />
          </td>
        ))}
      </tr>
    ));
  }

  // ---------------------------------------------------------------------------
  // Render — filter bar + table
  // ---------------------------------------------------------------------------

  const colSpan = canManage ? 7 : 6;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">SKUs</h1>
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
            Create SKU
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
        {/* Product filter */}
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

        {/* Status filter */}
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

        {/* Search */}
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

      {/* Table area */}
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
                    No SKUs found. {canManage ? 'Create your first SKU.' : ''}
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md
                              hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                          >
                            Edit
                          </button>
                          {item.status !== 'DISCONTINUED' && (
                            <button
                              type="button"
                              onClick={() => openDiscontinueDialog(item)}
                              className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-md
                                hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                            >
                              Discontinue
                            </button>
                          )}
                        </div>
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

      {/* ------------------------------------------------------------------ */}
      {/* Create SKU Modal                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Modal isOpen={createModalOpen} onClose={closeCreateModal} title="Create SKU">
        <form onSubmit={handleCreateSubmit} noValidate className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Product */}
          <div>
            <label htmlFor="create-product" className="block text-sm font-medium text-gray-700 mb-1">
              Product <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="create-product"
              required
              disabled={submitting}
              value={createForm.productId}
              onChange={(e) => handleCreateProductIdChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Option values — shown after product is selected */}
          {createForm.productId && (
            <>
              {loadingOptions ? (
                <div className="text-sm text-gray-500">Loading options…</div>
              ) : productOptions.length > 0 ? (
                productOptions.map((opt) => (
                  <div key={opt.id}>
                    <label htmlFor={`opt-${opt.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      {opt.name}
                    </label>
                    <select
                      id={`opt-${opt.id}`}
                      disabled={submitting}
                      value={createForm.optionSelections[opt.id] ?? ''}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          optionSelections: { ...f.optionSelections, [opt.id]: e.target.value },
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                        disabled:opacity-50 disabled:bg-gray-50"
                    >
                      <option value="">Select {opt.name}</option>
                      {(optionValuesMap[opt.id] ?? []).map((v) => (
                        <option key={v.id} value={v.id}>{v.value}</option>
                      ))}
                    </select>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">No options defined for this product.</p>
              )}
            </>
          )}

          {/* SKU code */}
          <div>
            <label htmlFor="create-sku" className="block text-sm font-medium text-gray-700 mb-1">
              SKU Code <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="create-sku"
              type="text"
              required
              disabled={submitting}
              value={createForm.sku}
              onChange={(e) => setCreateForm((f) => ({ ...f, sku: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. MEA-7-BLK"
            />
          </div>

          {/* Barcode */}
          <div>
            <label htmlFor="create-barcode" className="block text-sm font-medium text-gray-700 mb-1">
              Barcode <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="create-barcode"
              type="text"
              disabled={submitting}
              value={createForm.barcode}
              onChange={(e) => setCreateForm((f) => ({ ...f, barcode: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. 1234567890"
            />
          </div>

          {/* Price fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="create-purchase-price" className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price <span className="text-red-500">*</span>
              </label>
              <input
                id="create-purchase-price"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={submitting}
                value={createForm.purchasePrice}
                onChange={(e) => setCreateForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="create-selling-price" className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                id="create-selling-price"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={submitting}
                value={createForm.sellingPrice}
                onChange={(e) => setCreateForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="create-mrp" className="block text-sm font-medium text-gray-700 mb-1">
                MRP <span className="text-red-500">*</span>
              </label>
              <input
                id="create-mrp"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={submitting}
                value={createForm.mrp}
                onChange={(e) => setCreateForm((f) => ({ ...f, mrp: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Weight & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-weight" className="block text-sm font-medium text-gray-700 mb-1">
                Weight (kg) <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <input
                id="create-weight"
                type="number"
                min="0"
                step="0.01"
                disabled={submitting}
                value={createForm.weight}
                onChange={(e) => setCreateForm((f) => ({ ...f, weight: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="create-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="create-status"
                required
                disabled={submitting}
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    status: e.target.value as CreateFormData['status'],
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !createForm.productId || !createForm.sku.trim() || !createForm.purchasePrice || !createForm.sellingPrice || !createForm.mrp}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg
                hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={submitting}
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              )}
              {submitting ? 'Creating…' : 'Create SKU'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Edit SKU Modal                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Modal isOpen={editModalOpen} onClose={closeEditModal} title="Edit SKU">
        <form onSubmit={handleEditSubmit} noValidate className="space-y-4">
          {/* SKU code */}
          <div>
            <label htmlFor="edit-sku" className="block text-sm font-medium text-gray-700 mb-1">
              SKU Code <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-sku"
              type="text"
              required
              disabled={submitting}
              value={editForm.sku}
              onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* Barcode */}
          <div>
            <label htmlFor="edit-barcode" className="block text-sm font-medium text-gray-700 mb-1">
              Barcode <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="edit-barcode"
              type="text"
              disabled={submitting}
              value={editForm.barcode}
              onChange={(e) => setEditForm((f) => ({ ...f, barcode: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* Price fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-purchase-price" className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-purchase-price"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={submitting}
                value={editForm.purchasePrice}
                onChange={(e) => setEditForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label htmlFor="edit-selling-price" className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-selling-price"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={submitting}
                value={editForm.sellingPrice}
                onChange={(e) => setEditForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label htmlFor="edit-mrp" className="block text-sm font-medium text-gray-700 mb-1">
                MRP <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-mrp"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={submitting}
                value={editForm.mrp}
                onChange={(e) => setEditForm((f) => ({ ...f, mrp: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Weight & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-weight" className="block text-sm font-medium text-gray-700 mb-1">
                Weight (kg) <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <input
                id="edit-weight"
                type="number"
                min="0"
                step="0.01"
                disabled={submitting}
                value={editForm.weight}
                onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-status"
                required
                disabled={submitting}
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    status: e.target.value as EditFormData['status'],
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !editForm.sku.trim() || !editForm.purchasePrice || !editForm.sellingPrice || !editForm.mrp}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg
                hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={submitting}
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              )}
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Discontinue Confirm Dialog                                           */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title="Discontinue SKU"
        description={
          confirmTarget
            ? `Are you sure you want to discontinue "${confirmTarget.sku}"? This will mark the SKU as discontinued.`
            : ''
        }
        onConfirm={handleDiscontinue}
        onCancel={closeDiscontinueDialog}
      />
    </div>
  );
}
