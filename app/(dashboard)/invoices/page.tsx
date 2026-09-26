'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useToast } from '@/components/ui/ToastContext';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Invoice {
  id: string;
  saleId: string;
  invoiceNumber: string;
  financialYear: string;
  sequenceNumber: number;
  status: 'ACTIVE' | 'CANCELLED';
  generatedAt: string;
  customerName?: string | null;
  totalAmount?: string | null;
  salesChannel?: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helper: get current financial year
// ---------------------------------------------------------------------------

function getCurrentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  if (month >= 3) {
    // April onwards
    const startYY = String(year).slice(-2);
    const endYY = String(year + 1).slice(-2);
    return `${startYY}-${endYY}`;
  } else {
    const startYY = String(year - 1).slice(-2);
    const endYY = String(year).slice(-2);
    return `${startYY}-${endYY}`;
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InvoicesPage() {
  const { showToast } = useToast();

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Selection for bulk download
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // ---------------------------------------------------------------------------
  // Debounce search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      // Only trigger search API when 3+ characters typed, or when cleared
      if (search.length >= 3 || search.length === 0) {
        setSearchDebounced(search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ---------------------------------------------------------------------------
  // Fetch invoices
  // ---------------------------------------------------------------------------

  const fetchInvoices = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);

    let url = `/api/invoices?page=${page}&limit=20`;
    if (financialYear) url += `&financialYear=${financialYear}`;
    if (status) url += `&status=${status}`;
    if (searchDebounced) url += `&search=${encodeURIComponent(searchDebounced)}`;

    const result = await apiClient.get<Invoice[]>(url);

    if (result.success && 'data' in result) {
      setInvoices(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } else {
      setError(!result.success ? result.message : 'Unexpected response');
    }

    setLoading(false);
  }, [financialYear, status, searchDebounced]);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchInvoices(1);
  }, [fetchInvoices]);

  // ---------------------------------------------------------------------------
  // Download single invoice
  // ---------------------------------------------------------------------------

  async function handleDownload(invoiceId: string) {
    setDownloading(invoiceId);

    try {
      const token = getToken();
      const response = await fetch(`/api/invoices/${invoiceId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        showToast((errorData as Record<string, string>).message || 'Failed to download invoice', 'error');
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
    } catch {
      showToast('Network error while downloading', 'error');
    } finally {
      setDownloading(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk download
  // ---------------------------------------------------------------------------

  async function handleBulkDownload() {
    if (selectedIds.size === 0) {
      showToast('Select at least one invoice to download', 'error');
      return;
    }

    setBulkDownloading(true);

    try {
      const token = getToken();
      // Get sale IDs from selected invoices
      const saleIds = invoices
        .filter((inv) => selectedIds.has(inv.id))
        .map((inv) => inv.saleId);

      const response = await fetch('/api/invoices/bulk-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ saleIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        showToast((errorData as Record<string, string>).message || 'Bulk download failed', 'error');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'invoices.zip';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const generated = response.headers.get('X-Invoice-Generated');
      const skipped = response.headers.get('X-Invoice-Skipped');
      showToast(`Downloaded ${generated || saleIds.length} invoices${skipped && skipped !== '0' ? `, ${skipped} skipped` : ''}`, 'success');
      setSelectedIds(new Set());
    } catch {
      showToast('Network error during bulk download', 'error');
    } finally {
      setBulkDownloading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Selection handlers
  // ---------------------------------------------------------------------------

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search invoice number, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Financial Year */}
          <div>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Years</option>
              <option value={getCurrentFinancialYear()}>{`FY ${getCurrentFinancialYear()}`}</option>
              {/* Add previous years */}
              {(() => {
                const now = new Date();
                const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                const prev1 = `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
                const prev2 = `${String(year - 2).slice(-2)}-${String(year - 1).slice(-2)}`;
                return (
                  <>
                    <option value={prev1}>{`FY ${prev1}`}</option>
                    <option value={prev2}>{`FY ${prev2}`}</option>
                  </>
                );
              })()}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Bulk Download */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDownload}
              disabled={bulkDownloading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {bulkDownloading ? 'Downloading...' : `Download ${selectedIds.size} Invoices`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
          <span className="text-sm text-gray-500">
            {pagination.total} invoice{pagination.total !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => fetchInvoices(pagination.page)}
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
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={invoices.length > 0 && selectedIds.size === invoices.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      aria-label="Select all invoices"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">FY</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  renderSkeletonRows()
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-500">
                      No invoices found. Generate invoices from the Sales page.
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(invoice.id)}
                          onChange={() => toggleSelect(invoice.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`Select invoice ${invoice.invoiceNumber}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{invoice.customerName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{invoice.financialYear}</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {invoice.totalAmount ? `₹${parseFloat(invoice.totalAmount).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(invoice.generatedAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDownload(invoice.id)}
                          disabled={downloading === invoice.id}
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Download invoice ${invoice.invoiceNumber}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {downloading === invoice.id ? 'Downloading...' : 'Download'}
                        </button>
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
              onPageChange={(p) => fetchInvoices(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
