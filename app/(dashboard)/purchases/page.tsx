'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Purchase {
  id: string;
  companyId: string;
  supplierId: string | null;
  referenceNo: string;
  purchaseDate: string;
  totalAmount: string;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductItem {
  id: string;
  sku: string;
  productName: string;
  sellingPrice: string;
  purchasePrice: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LineItem {
  productItemId: string;
  quantity: string;
  unitPrice: string;
}

interface CreateFormData {
  supplierId: string;
  referenceNo: string;
  purchaseDate: string;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  notes: string;
  items: LineItem[];
}

const EMPTY_LINE_ITEM: LineItem = { productItemId: '', quantity: '1', unitPrice: '' };

const EMPTY_CREATE_FORM: CreateFormData = {
  supplierId: '',
  referenceNo: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  status: 'PENDING',
  notes: '',
  items: [{ ...EMPTY_LINE_ITEM }],
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PurchasesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Auth
  const [role] = useState<'OWNER' | 'MANAGER' | 'STAFF'>(() => getUser()?.role ?? 'STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormData>(EMPTY_CREATE_FORM);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchPurchases(page: number) {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<Purchase[]>(`/api/purchases?page=${page}&limit=20`);

    if (result.success && 'data' in result) {
      setPurchases(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } else {
      setError(!result.success ? result.message : 'Unexpected response format');
    }

    setLoading(false);
  }

  async function fetchProductItems() {
    const result = await apiClient.get<ProductItem[]>('/api/product-items?limit=500');
    if (result.success && 'data' in result) {
      setProductItems(Array.isArray(result.data) ? result.data : []);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchPurchases(1);
    fetchProductItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Create modal handlers
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setCreateForm({ ...EMPTY_CREATE_FORM, items: [{ ...EMPTY_LINE_ITEM }] });
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreateModalOpen(false);
    setCreateForm({ ...EMPTY_CREATE_FORM, items: [{ ...EMPTY_LINE_ITEM }] });
  }

  function addLineItem() {
    setCreateForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_LINE_ITEM }] }));
  }

  function removeLineItem(index: number) {
    setCreateForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string) {
    setCreateForm((f) => {
      const items = f.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        // Auto-fill unitPrice when productItemId changes
        if (field === 'productItemId' && value) {
          const found = productItems.find((p) => p.id === value);
          if (found) updated.unitPrice = found.purchasePrice;
        }
        return updated;
      });
      return { ...f, items };
    });
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Validate at least 1 line item
    if (createForm.items.length === 0) {
      showToast('At least one line item is required', 'error');
      return;
    }

    for (const item of createForm.items) {
      if (!item.productItemId) {
        showToast('All line items must have a product selected', 'error');
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      ...(createForm.supplierId.trim() ? { supplierId: createForm.supplierId.trim() } : {}),
      referenceNo: createForm.referenceNo.trim(),
      purchaseDate: createForm.purchaseDate,
      status: createForm.status,
      ...(createForm.notes.trim() ? { notes: createForm.notes.trim() } : {}),
      items: createForm.items.map((item) => ({
        productItemId: item.productItemId,
        quantity: parseInt(item.quantity, 10),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };

    const result = await apiClient.post<Purchase>('/api/purchases', payload);

    if (result.success) {
      showToast('Purchase created successfully', 'success');
      closeCreateModal();
      fetchPurchases(pagination.page);
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
        {Array.from({ length: 5 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className="h-4 w-full rounded" />
          </td>
        ))}
      </tr>
    ));
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Purchases</h1>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Purchase
          </button>
        )}
      </div>

      {/* Table area */}
      <div className="overflow-x-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchPurchases(pagination.page)}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-500">
                    {canManage
                      ? 'No purchases found. Create your first purchase.'
                      : 'No purchases found.'}
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push('/purchases/' + purchase.id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{purchase.referenceNo}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(purchase.purchaseDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">₹{parseFloat(purchase.totalAmount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={purchase.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(purchase.createdAt)}</td>
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
            onPageChange={(p) => fetchPurchases(p)}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create Purchase Modal                                                */}
      {/* ------------------------------------------------------------------ */}
      <Modal isOpen={createModalOpen} onClose={closeCreateModal} title="Create Purchase">
        <form onSubmit={handleCreateSubmit} noValidate className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Reference No */}
          <div>
            <label htmlFor="p-ref" className="block text-sm font-medium text-gray-700 mb-1">
              Reference No <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="p-ref"
              type="text"
              required
              disabled={submitting}
              value={createForm.referenceNo}
              onChange={(e) => setCreateForm((f) => ({ ...f, referenceNo: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. PO-2024-001"
            />
          </div>

          {/* Supplier ID */}
          <div>
            <label htmlFor="p-supplier" className="block text-sm font-medium text-gray-700 mb-1">
              Supplier ID <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="p-supplier"
              type="text"
              disabled={submitting}
              value={createForm.supplierId}
              onChange={(e) => setCreateForm((f) => ({ ...f, supplierId: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              placeholder="Supplier ID"
            />
          </div>

          {/* Purchase Date */}
          <div>
            <label htmlFor="p-date" className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Date <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="p-date"
              type="date"
              required
              disabled={submitting}
              value={createForm.purchaseDate}
              onChange={(e) => setCreateForm((f) => ({ ...f, purchaseDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="p-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="p-status"
              required
              disabled={submitting}
              value={createForm.status}
              onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value as CreateFormData['status'] }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="p-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              id="p-notes"
              rows={2}
              disabled={submitting}
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Line Items <span className="text-red-500" aria-hidden="true">*</span>
              </span>
              <button
                type="button"
                onClick={addLineItem}
                disabled={submitting}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-3">
              {createForm.items.map((item, idx) => (
                <div key={idx} className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg">
                  {/* Product Select */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Product SKU</label>
                    <select
                      required
                      disabled={submitting}
                      value={item.productItemId}
                      onChange={(e) => updateLineItem(idx, 'productItemId', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-white"
                    >
                      <option value="">Select SKU</option>
                      {productItems.map((pi) => (
                        <option key={pi.id} value={pi.id}>
                          {pi.sku} — {pi.productName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="w-20">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      disabled={submitting}
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-white"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="w-28">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      disabled={submitting}
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-white"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Remove */}
                  {createForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      disabled={submitting}
                      className="mb-0.5 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors
                focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
