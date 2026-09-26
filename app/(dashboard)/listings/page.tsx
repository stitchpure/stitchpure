'use client';

import { Fragment, useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';

// ── Types ────────────────────────────────────────────────────────────────────

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
  createdAt: string;
  updatedAt: string;
}

interface ProductItem {
  id: string;
  sku: string;
  productId: string;
  productName?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ListingPerformance {
  listingId: string;
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
  totalRevenue: number;
  profit: number;
}

interface ListingFormData {
  productItemId: string;
  channel: 'Meesho' | 'Flipkart' | 'Amazon' | 'Offline';
  title: string;
  listingPrice: string;
  platformSku: string;
  listingUrl: string;
}

const EMPTY_FORM: ListingFormData = {
  productItemId: '',
  channel: 'Meesho',
  title: '',
  listingPrice: '',
  platformSku: '',
  listingUrl: '',
};

const CHANNELS = ['Meesho', 'Flipkart', 'Amazon', 'Offline'] as const;

export default function ListingsPage() {
  const { showToast } = useToast();

  const [role] = useState<'OWNER' | 'MANAGER' | 'STAFF'>(() => getUser()?.role ?? 'STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  const [listings, setListings] = useState<Listing[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1, limit: 10, total: 0, totalPages: 1,
  });
  const [productItems, setProductItems] = useState<ProductItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [productItemFilter, setProductItemFilter] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [formData, setFormData] = useState<ListingFormData>(EMPTY_FORM);

  // Confirm dialog for deactivate
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [deactivatingListing, setDeactivatingListing] = useState<Listing | null>(null);

  // Performance (Task 13.2)
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<Record<string, ListingPerformance>>({});
  const [performanceLoading, setPerformanceLoading] = useState<string | null>(null);

  // ── Fetch listings ─────────────────────────────────────────────────────────

  async function fetchListings(page: number) {
    setLoading(true);
    setError(null);

    let url = `/api/listings?page=${page}&limit=10`;
    if (channelFilter) url += `&channel=${channelFilter}`;
    if (productItemFilter) url += `&productItemId=${productItemFilter}`;

    const result = await apiClient.get<Listing[]>(url);
    if (result.success && 'data' in result) {
      setListings(result.data);
      if (result.pagination) setPagination(result.pagination);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  async function fetchProductItems() {
    const result = await apiClient.get<ProductItem[]>('/api/product-items?limit=100');
    if (result.success && 'data' in result) {
      setProductItems(result.data);
    }
  }

  useEffect(() => {
    fetchListings(1);
    fetchProductItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchListings(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter, productItemFilter]);

  // ── Performance fetch (Task 13.2) ──────────────────────────────────────────

  async function togglePerformance(listingId: string) {
    if (expandedListingId === listingId) {
      setExpandedListingId(null);
      return;
    }

    setExpandedListingId(listingId);

    // If already fetched, just expand
    if (performanceData[listingId]) return;

    setPerformanceLoading(listingId);
    const result = await apiClient.get<ListingPerformance>(`/api/listings/${listingId}/performance`);
    if (result.success && 'data' in result) {
      setPerformanceData((prev) => ({ ...prev, [listingId]: result.data }));
    } else {
      showToast('Failed to load performance data', 'error');
    }
    setPerformanceLoading(null);
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreateModal() {
    setFormData(EMPTY_FORM);
    setIsCreateModalOpen(true);
  }
  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setFormData(EMPTY_FORM);
  }

  function openEditModal(listing: Listing) {
    setEditingListing(listing);
    setFormData({
      productItemId: listing.productItemId,
      channel: listing.channel,
      title: listing.title,
      listingPrice: listing.listingPrice,
      platformSku: listing.platformSku ?? '',
      listingUrl: listing.listingUrl ?? '',
    });
    setIsEditModalOpen(true);
  }
  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditingListing(null);
    setFormData(EMPTY_FORM);
  }

  function openDeactivateDialog(listing: Listing) {
    setDeactivatingListing(listing);
    setIsConfirmDialogOpen(true);
  }
  function closeDeactivateDialog() {
    setIsConfirmDialogOpen(false);
    setDeactivatingListing(null);
  }

  // ── Validation helper ────────────────────────────────────────────────────────

  function validateCreateForm(): string | null {
    if (!formData.productItemId) return 'Product item is required';
    if (!formData.title.trim()) return 'Title is required';
    if (formData.title.length > 300) return 'Title must be at most 300 characters';
    const price = Number(formData.listingPrice);
    if (isNaN(price) || price < 0) return 'Listing price must be 0 or greater';
    if (formData.platformSku && formData.platformSku.length > 150) return 'Platform SKU must be at most 150 characters';
    if (formData.listingUrl && formData.listingUrl.length > 500) return 'Listing URL must be at most 500 characters';
    if (formData.listingUrl) {
      try { new URL(formData.listingUrl); } catch { return 'Invalid listing URL format'; }
    }
    return null;
  }

  function validateEditForm(): string | null {
    if (!formData.title.trim()) return 'Title is required';
    if (formData.title.length > 300) return 'Title must be at most 300 characters';
    const price = Number(formData.listingPrice);
    if (isNaN(price) || price < 0) return 'Listing price must be 0 or greater';
    if (formData.platformSku && formData.platformSku.length > 150) return 'Platform SKU must be at most 150 characters';
    if (formData.listingUrl && formData.listingUrl.length > 500) return 'Listing URL must be at most 500 characters';
    if (formData.listingUrl) {
      try { new URL(formData.listingUrl); } catch { return 'Invalid listing URL format'; }
    }
    return null;
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateCreateForm();
    if (validationError) { showToast(validationError, 'error'); return; }

    setSubmitting(true);
    const payload = {
      productItemId: formData.productItemId,
      channel: formData.channel,
      title: formData.title.trim(),
      listingPrice: Number(formData.listingPrice),
      ...(formData.platformSku ? { platformSku: formData.platformSku.trim() } : {}),
      ...(formData.listingUrl ? { listingUrl: formData.listingUrl.trim() } : {}),
    };

    const result = await apiClient.post<Listing>('/api/listings', payload);
    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('Listing created successfully', 'success');
      closeCreateModal();
      fetchListings(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingListing) return;
    const validationError = validateEditForm();
    if (validationError) { showToast(validationError, 'error'); return; }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      title: formData.title.trim(),
      listingPrice: Number(formData.listingPrice),
    };
    if (formData.platformSku.trim()) payload.platformSku = formData.platformSku.trim();
    if (formData.listingUrl.trim()) payload.listingUrl = formData.listingUrl.trim();

    const result = await apiClient.put<Listing>(`/api/listings/${editingListing.id}`, payload);
    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('Listing updated successfully', 'success');
      closeEditModal();
      fetchListings(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  async function handleDeactivate() {
    if (!deactivatingListing) return;
    setSubmitting(true);
    const result = await apiClient.delete<Listing>(`/api/listings/${deactivatingListing.id}`);
    setSubmitting(false);

    if (result.success) {
      showToast('Listing deactivated successfully', 'success');
      closeDeactivateDialog();
      fetchListings(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function formatPrice(price: string | number): string {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Listings</h1>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Create Listing
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <label htmlFor="channel-filter" className="text-sm font-medium text-gray-600">Channel:</label>
            <select
              id="channel-filter"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All</option>
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="product-filter" className="text-sm font-medium text-gray-600">Product Item:</label>
            <select
              id="product-filter"
              value={productItemFilter}
              onChange={(e) => setProductItemFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All</option>
              {productItems.map((pi) => (
                <option key={pi.id} value={pi.id}>
                  {pi.productName ? `${pi.productName} - ${pi.sku}` : pi.sku}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
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

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button type="button" onClick={() => fetchListings(pagination.page)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && listings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No listings found. Create your first listing.</p>
            </div>
          )}

          {!loading && !error && listings.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Title</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Channel</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Price</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Platform SKU</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                      {canManage && (
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <Fragment key={listing.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <button
                              type="button"
                              onClick={() => togglePerformance(listing.id)}
                              className="text-left hover:text-indigo-600 transition-colors"
                              title="View performance"
                            >
                              {listing.title}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{listing.channel}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatPrice(listing.listingPrice)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{listing.platformSku ?? '—'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={listing.isActive ? 'ACTIVE' : 'INACTIVE'} />
                          </td>

                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => openEditModal(listing)}
                                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                                  Edit
                                </button>
                                {listing.isActive && (
                                  <button type="button" onClick={() => openDeactivateDialog(listing)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                                    Deactivate
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Performance expandable row (Task 13.2) */}
                        {expandedListingId === listing.id && (
                          <tr key={`${listing.id}-perf`} className="bg-indigo-50/50">
                            <td colSpan={canManage ? 6 : 5} className="px-4 py-4">
                              {performanceLoading === listing.id ? (
                                <div className="flex gap-4">
                                  <Skeleton className="h-8 w-1/5 rounded" />
                                  <Skeleton className="h-8 w-1/5 rounded" />
                                  <Skeleton className="h-8 w-1/5 rounded" />
                                  <Skeleton className="h-8 w-1/5 rounded" />
                                  <Skeleton className="h-8 w-1/5 rounded" />
                                </div>
                              ) : performanceData[listing.id] ? (
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {performanceData[listing.id].totalOrders}
                                    </p>
                                  </div>

                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Total Returns</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {performanceData[listing.id].totalReturns}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Return Rate</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {performanceData[listing.id].returnRate.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Revenue</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {formatPrice(performanceData[listing.id].totalRevenue)}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Profit</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                      {formatPrice(performanceData[listing.id].profit)}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No performance data available.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchListings} />
            </>
          )}
        </div>
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create Listing">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="create-productItem" className="block text-sm font-medium text-gray-700 mb-1">
              Product Item <span className="text-red-500">*</span>
            </label>
            <select id="create-productItem" required value={formData.productItemId}
              onChange={(e) => setFormData({ ...formData, productItemId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">Select a product item</option>
              {productItems.map((pi) => (
                <option key={pi.id} value={pi.id}>
                  {pi.productName ? `${pi.productName} - ${pi.sku}` : pi.sku}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="create-channel" className="block text-sm font-medium text-gray-700 mb-1">
              Channel <span className="text-red-500">*</span>
            </label>
            <select id="create-channel" required value={formData.channel}
              onChange={(e) => setFormData({ ...formData, channel: e.target.value as typeof formData.channel })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="create-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input id="create-title" type="text" required value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="create-price" className="block text-sm font-medium text-gray-700 mb-1">
              Listing Price (₹) <span className="text-red-500">*</span>
            </label>
            <input id="create-price" type="number" required min="0" step="0.01" value={formData.listingPrice}
              onChange={(e) => setFormData({ ...formData, listingPrice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="create-platformSku" className="block text-sm font-medium text-gray-700 mb-1">
              Platform SKU <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input id="create-platformSku" type="text" value={formData.platformSku}
              onChange={(e) => setFormData({ ...formData, platformSku: e.target.value })}
              maxLength={150}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="create-listingUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Listing URL <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input id="create-listingUrl" type="url" value={formData.listingUrl}
              onChange={(e) => setFormData({ ...formData, listingUrl: e.target.value })}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeCreateModal} disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title="Edit Listing">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input id="edit-title" type="text" required value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-1">
              Listing Price (₹) <span className="text-red-500">*</span>
            </label>
            <input id="edit-price" type="number" required min="0" step="0.01" value={formData.listingPrice}
              onChange={(e) => setFormData({ ...formData, listingPrice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="edit-platformSku" className="block text-sm font-medium text-gray-700 mb-1">
              Platform SKU <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input id="edit-platformSku" type="text" value={formData.platformSku}
              onChange={(e) => setFormData({ ...formData, platformSku: e.target.value })}
              maxLength={150}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="edit-listingUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Listing URL <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input id="edit-listingUrl" type="url" value={formData.listingUrl}
              onChange={(e) => setFormData({ ...formData, listingUrl: e.target.value })}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeEditModal} disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Dialog ───────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        title="Deactivate Listing"
        description={`Are you sure you want to deactivate "${deactivatingListing?.title}"? The listing will be marked as inactive.`}
        onConfirm={handleDeactivate}
        onCancel={closeDeactivateDialog}
      />
    </div>
  );
}
