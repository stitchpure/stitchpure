'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUser, getToken } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import Skeleton from '@/components/ui/Skeleton';
import PackingVerification from '@/components/packing-verification';
import ReturnProcessing from '@/components/return-processing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaleItem {
  id: string;
  productItemId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface SaleDetail {
  id: string;
  companyId: string;
  referenceNo: string;
  saleDate: string;
  customerName: string | null;
  customerPhone: string | null;
  buyerAddress: string | null;
  buyerGstin: string | null;
  shippingAddress: string | null;
  placeOfSupply: string | null;
  totalAmount: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
  returnStatus: string | null;
  returnReason: string | null;
  returnCondition: string | null;
  returnedAt: string | null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { showToast } = useToast();

  // Auth
  const [role] = useState<'OWNER' | 'MANAGER' | 'STAFF'>(() => getUser()?.role ?? 'STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Invoice
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Confirm dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Packing verification
  const [showPackingVerification, setShowPackingVerification] = useState(false);

  // Return processing
  const [showReturnProcessing, setShowReturnProcessing] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchSale() {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<SaleDetail>(`/api/sales/${id}`);

    if (result.success && 'data' in result) {
      setSale(result.data);
    } else {
      setError(!result.success ? result.message : 'Unexpected response format');
    }

    setLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchSale();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function handleMarkCompleted() {
    if (actionLoading || !sale) return;
    setActionLoading(true);

    const result = await apiClient.patch<SaleDetail>(`/api/sales/${id}`, {
      status: 'COMPLETED',
    });

    if (result.success) {
      showToast('Sale marked as completed', 'success');
      fetchSale();
    } else {
      // 422 insufficient stock — show descriptive message
      const msg = result.message ?? 'Failed to complete sale';
      showToast(msg, 'error');
    }

    setActionLoading(false);
  }

  async function handleCancel() {
    if (actionLoading || !sale) return;
    setActionLoading(true);
    setCancelDialogOpen(false);

    const result = await apiClient.patch<SaleDetail>(`/api/sales/${id}`, {
      status: 'CANCELLED',
    });

    if (result.success) {
      showToast('Sale cancelled', 'success');
      fetchSale();
    } else {
      showToast(result.message, 'error');
    }

    setActionLoading(false);
  }

  async function handleDelete() {
    if (actionLoading || !sale) return;
    setActionLoading(true);
    setDeleteDialogOpen(false);

    const result = await apiClient.delete<unknown>(`/api/sales/${id}`);

    if (result.success) {
      showToast('Sale deleted', 'success');
      router.push('/sales');
    } else {
      showToast(result.message, 'error');
      setActionLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Invoice download
  // ---------------------------------------------------------------------------

  async function handleDownloadInvoice() {
    if (invoiceLoading || !sale) return;
    setInvoiceLoading(true);

    try {
      const token = getToken();
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ saleId: sale.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        showToast((errorData as Record<string, string>).message || 'Failed to generate invoice', 'error');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'invoice.pdf';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show warnings if any
      const warningsHeader = response.headers.get('X-Invoice-Warnings');
      if (warningsHeader) {
        try {
          const warnings = JSON.parse(warningsHeader) as string[];
          if (warnings.length > 0) {
            showToast(`Invoice downloaded. Warnings: ${warnings.join(', ')}`, 'success');
            return;
          }
        } catch { /* ignore */ }
      }

      showToast('Invoice downloaded successfully', 'success');
    } catch {
      showToast('Network error while generating invoice', 'error');
    } finally {
      setInvoiceLoading(false);
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
          onClick={fetchSale}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!sale) return null;

  const isPending = sale.status === 'PENDING';
  const showActions = canManage && isPending;

  // ---------------------------------------------------------------------------
  // Render — detail
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push('/sales')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sales
      </button>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{sale.referenceNo}</h1>
            <p className="text-sm text-gray-500 mt-1">Sale Date: {formatDate(sale.saleDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={sale.status} />
            {/* Download Invoice button — visible for COMPLETED sales */}
            {sale.status === 'COMPLETED' && (
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={invoiceLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {invoiceLoading ? 'Generating...' : 'Download Invoice'}
              </button>
            )}
            {/* Process Return button — visible for COMPLETED sales that are not already returned */}
            {sale.status === 'COMPLETED' && sale.returnStatus !== 'RETURNED' && (
              <button
                type="button"
                onClick={() => setShowReturnProcessing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Process Return
              </button>
            )}
            {/* Verify Packing button — visible for COMPLETED or PENDING sales */}
            {(sale.status === 'COMPLETED' || sale.status === 'PENDING') && (
              <button
                type="button"
                onClick={() => setShowPackingVerification(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Verify Packing
              </button>
            )}
            {showActions && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkCompleted}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Completed
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

        {/* Sale metadata */}
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Customer Name</p>
            <p className="font-medium text-gray-900 mt-0.5">{sale.customerName ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Customer Phone</p>
            <p className="font-medium text-gray-900 mt-0.5">{sale.customerPhone ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Amount</p>
            <p className="font-medium text-gray-900 mt-0.5">₹{parseFloat(sale.totalAmount).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500">Created At</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDateTime(sale.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Last Updated</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDateTime(sale.updatedAt)}</p>
          </div>
          {sale.buyerGstin && (
            <div>
              <p className="text-gray-500">Buyer GSTIN</p>
              <p className="font-medium text-gray-900 mt-0.5">{sale.buyerGstin}</p>
            </div>
          )}
          {sale.placeOfSupply && (
            <div>
              <p className="text-gray-500">Place of Supply</p>
              <p className="font-medium text-gray-900 mt-0.5">{sale.placeOfSupply}</p>
            </div>
          )}
          {sale.shippingAddress ? (
            <>
              <div className="col-span-2">
                <p className="text-gray-500">Billing Address</p>
                <p className="font-medium text-gray-900 mt-0.5">{sale.buyerAddress ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Shipping Address</p>
                <p className="font-medium text-gray-900 mt-0.5">{sale.shippingAddress}</p>
              </div>
            </>
          ) : sale.buyerAddress ? (
            <div className="col-span-2">
              <p className="text-gray-500">Billing & Shipping Address</p>
              <p className="font-medium text-gray-900 mt-0.5">{sale.buyerAddress}</p>
            </div>
          ) : null}
          {sale.notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-gray-500">Notes</p>
              <p className="font-medium text-gray-900 mt-0.5">{sale.notes}</p>
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
              {sale.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                    No line items found.
                  </td>
                </tr>
              ) : (
                sale.items.map((item) => (
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

      {/* Packing verification panel */}
      {showPackingVerification && (
        <PackingVerification
          saleId={sale.id}
          saleItems={sale.items}
          onClose={() => setShowPackingVerification(false)}
        />
      )}

      {/* Return processing panel */}
      {showReturnProcessing && (
        <ReturnProcessing
          saleId={sale.id}
          saleItems={sale.items}
          onClose={() => setShowReturnProcessing(false)}
          onReturnProcessed={() => {
            setShowReturnProcessing(false);
            fetchSale();
          }}
        />
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        title="Cancel Sale"
        description={`Are you sure you want to cancel sale "${sale.referenceNo}"? This action cannot be undone.`}
        onConfirm={handleCancel}
        onCancel={() => setCancelDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Sale"
        description={`Are you sure you want to delete sale "${sale.referenceNo}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
