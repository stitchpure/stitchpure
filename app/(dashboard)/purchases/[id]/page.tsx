'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PurchaseItem {
  id: string;
  productItemId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface PurchaseDetail {
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
  items: PurchaseItem[];
}

interface ProductItem {
  id: string;
  sku: string;
  productName: string;
  sellingPrice: string;
  purchasePrice: string;
}

interface EditLineItem {
  productItemId: string;
  quantity: string;
  unitPrice: string;
}

interface EditFormData {
  supplierId: string;
  referenceNo: string;
  purchaseDate: string;
  notes: string;
  items: EditLineItem[];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { showToast } = useToast();

  // Auth
  const [role] = useState<'OWNER' | 'MANAGER' | 'STAFF'>(() => getUser()?.role ?? 'STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);

  // Confirm dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchPurchase() {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<PurchaseDetail>(`/api/purchases/${id}`);

    if (result.success && 'data' in result) {
      setPurchase(result.data);
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
    fetchPurchase();
    fetchProductItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------------------------------------------------------------------
  // Edit mode helpers
  // ---------------------------------------------------------------------------

  function startEditing() {
    if (!purchase) return;
    setEditForm({
      supplierId: purchase.supplierId ?? '',
      referenceNo: purchase.referenceNo ?? '',
      purchaseDate: purchase.purchaseDate.split('T')[0],
      notes: purchase.notes ?? '',
      items: purchase.items.map((item) => ({
        productItemId: item.productItemId,
        quantity: String(item.quantity),
        unitPrice: item.unitPrice,
      })),
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditForm(null);
  }

  function addEditLineItem() {
    if (!editForm) return;
    setEditForm((f) => f ? { ...f, items: [...f.items, { productItemId: '', quantity: '1', unitPrice: '' }] } : f);
  }

  function removeEditLineItem(index: number) {
    if (!editForm) return;
    setEditForm((f) => f ? { ...f, items: f.items.filter((_, i) => i !== index) } : f);
  }

  function updateEditLineItem(index: number, field: keyof EditLineItem, value: string) {
    if (!editForm) return;
    setEditForm((f) => {
      if (!f) return f;
      const items = f.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'productItemId' && value) {
          const found = productItems.find((p) => p.id === value);
          if (found) updated.unitPrice = found.purchasePrice;
        }
        return updated;
      });
      return { ...f, items };
    });
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editSubmitting || !editForm) return;

    if (editForm.items.length === 0) {
      showToast('At least one line item is required', 'error');
      return;
    }

    for (const item of editForm.items) {
      if (!item.productItemId) {
        showToast('All line items must have a product selected', 'error');
        return;
      }
    }

    setEditSubmitting(true);

    const payload = {
      ...(editForm.supplierId.trim() ? { supplierId: editForm.supplierId.trim() } : { supplierId: null }),
      referenceNo: editForm.referenceNo.trim() || undefined,
      purchaseDate: editForm.purchaseDate,
      ...(editForm.notes.trim() ? { notes: editForm.notes.trim() } : {}),
      items: editForm.items.map((item) => ({
        productItemId: item.productItemId,
        quantity: parseInt(item.quantity, 10),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };

    const result = await apiClient.put<PurchaseDetail>(`/api/purchases/${id}`, payload);

    if (result.success) {
      showToast('Purchase edited successfully', 'success');
      setEditing(false);
      setEditForm(null);
      fetchPurchase();
    } else {
      showToast(result.message, 'error');
    }

    setEditSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function handleMarkReceived() {
    if (actionLoading || !purchase) return;
    setActionLoading(true);

    const result = await apiClient.patch<PurchaseDetail>(`/api/purchases/${id}`, {
      status: 'RECEIVED',
    });

    if (result.success) {
      showToast('Purchase marked as received', 'success');
      fetchPurchase();
    } else {
      showToast(result.message, 'error');
    }

    setActionLoading(false);
  }

  async function handleCancel() {
    if (actionLoading || !purchase) return;
    setActionLoading(true);
    setCancelDialogOpen(false);

    const result = await apiClient.patch<PurchaseDetail>(`/api/purchases/${id}`, {
      status: 'CANCELLED',
    });

    if (result.success) {
      showToast('Purchase cancelled', 'success');
      fetchPurchase();
    } else {
      showToast(result.message, 'error');
    }

    setActionLoading(false);
  }

  async function handleDelete() {
    if (actionLoading || !purchase) return;
    setActionLoading(true);
    setDeleteDialogOpen(false);

    const result = await apiClient.delete<unknown>(`/api/purchases/${id}`);

    if (result.success) {
      showToast('Purchase deleted', 'success');
      router.push('/purchases');
    } else {
      showToast(result.message, 'error');
      setActionLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString();
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  // ---------------------------------------------------------------------------
  // Render — loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <Skeleton className="h-8 w-64 rounded" />
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-5 w-32 rounded" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — error
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchPurchase}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!purchase) return null;

  const isPending = purchase.status === 'PENDING';
  const showActions = canManage && isPending;

  // ---------------------------------------------------------------------------
  // Render — edit form
  // ---------------------------------------------------------------------------

  if (editing && editForm) {
    return (
      <div className="space-y-6">
        {/* Back nav */}
        <button
          type="button"
          onClick={cancelEditing}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Cancel Editing
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">Edit Purchase</h1>

          <form onSubmit={handleEditSubmit} noValidate className="space-y-4">
            {/* Reference No */}
            <div>
              <label htmlFor="edit-ref" className="block text-sm font-medium text-gray-700 mb-1">
                Reference No <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="edit-ref"
                type="text"
                required
                disabled={editSubmitting}
                value={editForm.referenceNo}
                onChange={(e) => setEditForm((f) => f ? { ...f, referenceNo: e.target.value } : f)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                placeholder="e.g. PO-2024-001"
              />
            </div>

            {/* Supplier ID */}
            <div>
              <label htmlFor="edit-supplier" className="block text-sm font-medium text-gray-700 mb-1">
                Supplier ID <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <input
                id="edit-supplier"
                type="text"
                disabled={editSubmitting}
                value={editForm.supplierId}
                onChange={(e) => setEditForm((f) => f ? { ...f, supplierId: e.target.value } : f)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                placeholder="Supplier ID"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label htmlFor="edit-date" className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="edit-date"
                type="date"
                required
                disabled={editSubmitting}
                value={editForm.purchaseDate}
                onChange={(e) => setEditForm((f) => f ? { ...f, purchaseDate: e.target.value } : f)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <textarea
                id="edit-notes"
                rows={2}
                disabled={editSubmitting}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
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
                  onClick={addEditLineItem}
                  disabled={editSubmitting}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-3">
                {editForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg">
                    {/* Product Select */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Product SKU</label>
                      <select
                        required
                        disabled={editSubmitting}
                        value={item.productItemId}
                        onChange={(e) => updateEditLineItem(idx, 'productItemId', e.target.value)}
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
                        disabled={editSubmitting}
                        value={item.quantity}
                        onChange={(e) => updateEditLineItem(idx, 'quantity', e.target.value)}
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
                        disabled={editSubmitting}
                        value={item.unitPrice}
                        onChange={(e) => updateEditLineItem(idx, 'unitPrice', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-white"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Remove */}
                    {editForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEditLineItem(idx)}
                        disabled={editSubmitting}
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
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={editSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — detail
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push('/purchases')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Purchases
      </button>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{purchase.referenceNo}</h1>
            <p className="text-sm text-gray-500 mt-1">Purchase Date: {formatDate(purchase.purchaseDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={purchase.status} />
            {showActions && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleMarkReceived}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Received
                </button>
                <button
                  type="button"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Purchase metadata */}
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Supplier ID</p>
            <p className="font-medium text-gray-900 mt-0.5">{purchase.supplierId ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Amount</p>
            <p className="font-medium text-gray-900 mt-0.5">₹{parseFloat(purchase.totalAmount).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500">Created At</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDateTime(purchase.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Last Updated</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDateTime(purchase.updatedAt)}</p>
          </div>
          {purchase.notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-gray-500">Notes</p>
              <p className="font-medium text-gray-900 mt-0.5">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Item ID</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Price</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                    No line items found.
                  </td>
                </tr>
              ) : (
                purchase.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{item.productItemId}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-900">₹{parseFloat(item.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">₹{parseFloat(item.totalPrice).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        title="Cancel Purchase"
        description={`Are you sure you want to cancel purchase "${purchase.referenceNo}"? This action cannot be undone.`}
        onConfirm={handleCancel}
        onCancel={() => setCancelDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Purchase"
        description={`Are you sure you want to delete purchase "${purchase.referenceNo}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
