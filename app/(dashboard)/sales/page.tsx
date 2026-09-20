'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import dynamic from 'next/dynamic';
import type { ScannedProductItem } from '@/components/barcode-scanner';

const BarcodeScanner = dynamic(() => import('@/components/barcode-scanner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
      Loading scanner…
    </div>
  ),
});
import { isValidGstin, GSTIN_ERROR_MESSAGE } from '@/lib/gstin';
import { INDIAN_STATES } from '@/lib/indian-states';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sale {
  id: string;
  companyId: string;
  referenceNo: string;
  saleDate: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  returnStatus: string | null;
  returnReason: string | null;
  returnCondition: string | null;
  returnedAt: string | null;
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

interface Listing {
  id: string;
  companyId: string;
  productItemId: string;
  channel: 'Meesho' | 'Flipkart' | 'Amazon' | 'Offline';
  title: string;
  listingPrice: string;
  platformSku: string | null;
  listingUrl: string | null;
  isActive: boolean;
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
  /** Scanned product info for display (only present for barcode-scanned items) */
  scannedInfo?: {
    productName: string;
    variantInfo: string;
    currentStock: number;
  };
}

type Channel = 'Meesho' | 'Flipkart' | 'Amazon' | 'Offline' | '';

interface CreateFormData {
  referenceNo: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes: string;
  buyerGstin: string;
  shippingAddress: string;
  placeOfSupply: string;
  channel: Channel;
  listingId: string;
  items: LineItem[];
}

const EMPTY_LINE_ITEM: LineItem = { productItemId: '', quantity: '1', unitPrice: '' };

const EMPTY_CREATE_FORM: CreateFormData = {
  referenceNo: '',
  saleDate: new Date().toISOString().split('T')[0],
  customerName: '',
  customerPhone: '',
  status: 'PENDING',
  notes: '',
  buyerGstin: '',
  shippingAddress: '',
  placeOfSupply: '',
  channel: '',
  listingId: '',
  items: [{ ...EMPTY_LINE_ITEM }],
};

const CHANNELS: Array<{ value: Channel; label: string }> = [
  { value: '', label: 'Select channel (optional)' },
  { value: 'Meesho', label: 'Meesho' },
  { value: 'Flipkart', label: 'Flipkart' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'Offline', label: 'Offline' },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SalesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Auth
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [sales, setSales] = useState<Sale[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
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
  const [gstinError, setGstinError] = useState<string | null>(null);

  // Barcode scanner state
  const [scannerVisible, setScannerVisible] = useState(false);

  // Return status filter
  const [returnStatusFilter, setReturnStatusFilter] = useState<'ALL' | 'RETURNED'>('ALL');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchSales(page: number, returnFilter?: 'ALL' | 'RETURNED') {
    setLoading(true);
    setError(null);

    const filter = returnFilter ?? returnStatusFilter;
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filter === 'RETURNED') {
      params.set('returnStatus', 'RETURNED');
    }

    const result = await apiClient.get<Sale[]>(`/api/sales?${params.toString()}`);

    if (result.success && 'data' in result) {
      setSales(Array.isArray(result.data) ? result.data : []);
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

  async function fetchListings(channel?: string) {
    const url = channel
      ? `/api/listings?limit=200&isActive=true&channel=${encodeURIComponent(channel)}`
      : '/api/listings?limit=200&isActive=true';
    const result = await apiClient.get<Listing[]>(url);
    if (result.success && 'data' in result) {
      setListings(Array.isArray(result.data) ? result.data : []);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const user = getUser();
    if (user) setRole(user.role);
    fetchSales(1);
    fetchProductItems();
    fetchListings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Create modal handlers
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setCreateForm({ ...EMPTY_CREATE_FORM, items: [{ ...EMPTY_LINE_ITEM }] });
    setGstinError(null);
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreateModalOpen(false);
    setCreateForm({ ...EMPTY_CREATE_FORM, items: [{ ...EMPTY_LINE_ITEM }] });
    setGstinError(null);
    setScannerVisible(false);
  }

  // ---------------------------------------------------------------------------
  // Barcode scan handlers
  // ---------------------------------------------------------------------------

  const handleScanSuccess = useCallback((scannedItem: ScannedProductItem) => {
    setCreateForm((f) => {
      // Find matching productItem to get selling price
      const matchedProduct = productItems.find((p) => p.id === scannedItem.id);
      const unitPrice = matchedProduct?.sellingPrice ?? '';

      const newItem: LineItem = {
        productItemId: scannedItem.id,
        quantity: '1',
        unitPrice,
        scannedInfo: {
          productName: scannedItem.productName,
          variantInfo: scannedItem.variantInfo,
          currentStock: scannedItem.currentStock,
        },
      };

      // If there's only one empty line item, replace it; otherwise append
      const hasOnlyEmptyItem = f.items.length === 1 && !f.items[0].productItemId;
      const items = hasOnlyEmptyItem ? [newItem] : [...f.items, newItem];

      return { ...f, items };
    });

    showToast(`Added: ${scannedItem.productName} (${scannedItem.variantInfo})`, 'success');
  }, [productItems, showToast]);

  const handleScanError = useCallback((errorMsg: string) => {
    showToast(errorMsg, 'error');
  }, [showToast]);

  // ---------------------------------------------------------------------------
  // Channel change handler — refetch listings when channel changes
  // ---------------------------------------------------------------------------

  function handleChannelChange(channel: Channel) {
    setCreateForm((f) => ({ ...f, channel, listingId: '' }));
    if (channel) {
      fetchListings(channel);
    } else {
      fetchListings();
    }
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
        // Auto-fill unitPrice when productItemId changes (use sellingPrice for sales)
        if (field === 'productItemId' && value) {
          const found = productItems.find((p) => p.id === value);
          if (found) updated.unitPrice = found.sellingPrice;
        }
        return updated;
      });
      return { ...f, items };
    });
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Validate buyer GSTIN if provided
    const trimmedGstin = createForm.buyerGstin.trim();
    if (trimmedGstin && !isValidGstin(trimmedGstin)) {
      setGstinError(GSTIN_ERROR_MESSAGE);
      return;
    }
    setGstinError(null);

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
      referenceNo: createForm.referenceNo.trim(),
      saleDate: createForm.saleDate,
      ...(createForm.customerName.trim() ? { customerName: createForm.customerName.trim() } : {}),
      ...(createForm.customerPhone.trim() ? { customerPhone: createForm.customerPhone.trim() } : {}),
      status: createForm.status,
      ...(createForm.notes.trim() ? { notes: createForm.notes.trim() } : {}),
      buyerGstin: trimmedGstin || null,
      shippingAddress: createForm.shippingAddress.trim() || null,
      placeOfSupply: createForm.placeOfSupply || null,
      ...(createForm.channel ? { channel: createForm.channel } : {}),
      ...(createForm.listingId ? { listingId: createForm.listingId } : {}),
      items: createForm.items.map((item) => ({
        productItemId: item.productItemId,
        quantity: parseInt(item.quantity, 10),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };

    const result = await apiClient.post<Sale>('/api/sales', payload);

    if (result.success) {
      showToast('Sale created successfully', 'success');
      closeCreateModal();
      fetchSales(pagination.page);
    } else {
      // Handle 422 insufficient stock with descriptive message
      const msg = result.message ?? 'Failed to create sale';
      showToast(msg, 'error');
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100">
        {Array.from({ length: 10 }).map((__, j) => (
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
        <h1 className="text-xl font-semibold text-gray-900">Sales</h1>
        <div className="flex items-center gap-3">
          {/* Return Status Filter */}
          <select
            value={returnStatusFilter}
            onChange={(e) => {
              const val = e.target.value as 'ALL' | 'RETURNED';
              setReturnStatusFilter(val);
              fetchSales(1, val);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="ALL">All Orders</option>
            <option value="RETURNED">Returned Only</option>
          </select>

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
              Create Sale
            </button>
          )}
        </div>
      </div>

      {/* Table area */}
      <div className="overflow-x-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchSales(pagination.page)}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Return Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Return Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Return Condition</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Returned At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-sm text-gray-500">
                    {canManage
                      ? 'No sales found. Create your first sale.'
                      : 'No sales found.'}
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push('/sales/' + sale.id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{sale.referenceNo}</td>
                    <td className="px-4 py-3 text-gray-600">{sale.customerName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(sale.saleDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">₹{parseFloat(sale.totalAmount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sale.returnStatus ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          {sale.returnStatus}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sale.returnReason ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{sale.returnCondition ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{sale.returnedAt ? formatDate(sale.returnedAt) : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(sale.createdAt)}</td>
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
            onPageChange={(p) => fetchSales(p)}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create Sale Modal                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Modal isOpen={createModalOpen} onClose={closeCreateModal} title="Create Sale">
        <form onSubmit={handleCreateSubmit} noValidate className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Reference No */}
          <div>
            <label htmlFor="s-ref" className="block text-sm font-medium text-gray-700 mb-1">
              Reference No <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="s-ref"
              type="text"
              required
              disabled={submitting}
              value={createForm.referenceNo}
              onChange={(e) => setCreateForm((f) => ({ ...f, referenceNo: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. SO-2024-001"
            />
          </div>

          {/* Sale Date */}
          <div>
            <label htmlFor="s-date" className="block text-sm font-medium text-gray-700 mb-1">
              Sale Date <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="s-date"
              type="date"
              required
              disabled={submitting}
              value={createForm.saleDate}
              onChange={(e) => setCreateForm((f) => ({ ...f, saleDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* Customer Name */}
          <div>
            <label htmlFor="s-customer-name" className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="s-customer-name"
              type="text"
              disabled={submitting}
              value={createForm.customerName}
              onChange={(e) => setCreateForm((f) => ({ ...f, customerName: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              placeholder="Customer name"
            />
          </div>

          {/* Customer Phone */}
          <div>
            <label htmlFor="s-customer-phone" className="block text-sm font-medium text-gray-700 mb-1">
              Customer Phone <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="s-customer-phone"
              type="tel"
              disabled={submitting}
              value={createForm.customerPhone}
              onChange={(e) => setCreateForm((f) => ({ ...f, customerPhone: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              placeholder="Phone number"
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="s-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="s-status"
              required
              disabled={submitting}
              value={createForm.status}
              onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value as CreateFormData['status'] }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="s-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              id="s-notes"
              rows={2}
              disabled={submitting}
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* Buyer GSTIN */}
          <div>
            <label htmlFor="s-buyer-gstin" className="block text-sm font-medium text-gray-700 mb-1">
              Buyer GSTIN <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="s-buyer-gstin"
              type="text"
              maxLength={15}
              disabled={submitting}
              value={createForm.buyerGstin}
              onChange={(e) => {
                setCreateForm((f) => ({ ...f, buyerGstin: e.target.value.toUpperCase() }));
                if (gstinError) setGstinError(null);
              }}
              className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50
                ${gstinError ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g. 22AAAAA0000A1Z5"
            />
            {gstinError && (
              <p className="mt-1 text-xs text-red-600">{gstinError}</p>
            )}
          </div>

          {/* Shipping Address */}
          <div>
            <label htmlFor="s-shipping-address" className="block text-sm font-medium text-gray-700 mb-1">
              Shipping Address <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              id="s-shipping-address"
              rows={2}
              disabled={submitting}
              value={createForm.shippingAddress}
              onChange={(e) => setCreateForm((f) => ({ ...f, shippingAddress: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
              placeholder="Shipping address (if different from billing)"
            />
          </div>

          {/* Place of Supply */}
          <div>
            <label htmlFor="s-place-of-supply" className="block text-sm font-medium text-gray-700 mb-1">
              Place of Supply <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <select
              id="s-place-of-supply"
              disabled={submitting}
              value={createForm.placeOfSupply}
              onChange={(e) => setCreateForm((f) => ({ ...f, placeOfSupply: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">Select state / UT</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div>
            <label htmlFor="s-channel" className="block text-sm font-medium text-gray-700 mb-1">
              Channel <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <select
              id="s-channel"
              disabled={submitting}
              value={createForm.channel}
              onChange={(e) => handleChannelChange(e.target.value as Channel)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            >
              {CHANNELS.map((ch) => (
                <option key={ch.value} value={ch.value}>
                  {ch.label}
                </option>
              ))}
            </select>
          </div>

          {/* Listing */}
          <div>
            <label htmlFor="s-listing" className="block text-sm font-medium text-gray-700 mb-1">
              Listing <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <select
              id="s-listing"
              disabled={submitting}
              value={createForm.listingId}
              onChange={(e) => setCreateForm((f) => ({ ...f, listingId: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">No listing (optional)</option>
              {listings
                .filter((l) => !createForm.channel || l.channel === createForm.channel)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} — {l.channel} (₹{parseFloat(l.listingPrice).toFixed(0)})
                  </option>
                ))}
            </select>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Line Items <span className="text-red-500" aria-hidden="true">*</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScannerVisible((v) => !v)}
                  disabled={submitting}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                    scannerVisible
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4h4V3H2v5h1V4zm18-1h-5v1h4v4h1V3zM3 20v-4H2v5h5v-1H3zm18 0h-4v1h5v-5h-1v4zM7 7h3v3H7V7zm7 0h3v3h-3V7zm-7 7h3v3H7v-3zm7 0h3v3h-3v-3z"
                    />
                  </svg>
                  {scannerVisible ? 'Hide Scanner' : 'Scan Barcode'}
                </button>
                <button
                  type="button"
                  onClick={addLineItem}
                  disabled={submitting}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  + Add Item
                </button>
              </div>
            </div>

            {/* Barcode Scanner */}
            {scannerVisible && (
              <div className="mb-3">
                <BarcodeScanner
                  onScanSuccess={handleScanSuccess}
                  onScanError={handleScanError}
                  autoStart
                  className="max-h-[260px]"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Scan barcodes to quickly add line items. Scanner stays active for consecutive scans.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {createForm.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  {/* Scanned product info banner */}
                  {item.scannedInfo && (
                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded text-xs">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-800 font-medium">{item.scannedInfo.productName}</span>
                      <span className="text-green-700">• {item.scannedInfo.variantInfo}</span>
                      <span className="text-green-600 ml-auto">Stock: {item.scannedInfo.currentStock}</span>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
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
