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
import ImageUpload from '@/components/ui/ImageUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  hsnCode: string | null;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProductFormData {
  name: string;
  categoryId: string;
  hsnCode: string;
  description: string;
  images: string[]; // up to 3
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  categoryId: '',
  hsnCode: '',
  description: '',
  images: ['', '', ''],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const { showToast } = useToast();

  // Auth
  const [role, setRole] = useState<UserRole | null>(null);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / dialog state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    const [productsResult, categoriesResult] = await Promise.all([
      apiClient.get<Product[]>(`/api/products?page=${page}&limit=10`),
      apiClient.get<Category[]>('/api/categories'),
    ]);

    if (!productsResult.success) {
      setError(productsResult.message);
      setLoading(false);
      return;
    }

    if (!categoriesResult.success) {
      setError(categoriesResult.message);
      setLoading(false);
      return;
    }

    setProducts(productsResult.data);
    setCategories(categoriesResult.data);

    if (productsResult.pagination) {
      setPagination(productsResult.pagination);
    }

    setLoading(false);
  }, []);

  // ---------------------------------------------------------------------------
  // On mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const user = getUser();
    setRole(user?.role ?? null);
    fetchData(1);
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Role helper
  // ---------------------------------------------------------------------------

  const canManage = role === 'OWNER' || role === 'MANAGER';

  // ---------------------------------------------------------------------------
  // Category lookup helper
  // ---------------------------------------------------------------------------

  function getCategoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? '—';
  }

  // ---------------------------------------------------------------------------
  // Create / Edit modal
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      hsnCode: product.hsnCode ?? '',
      description: product.description ?? '',
      images: [
        product.images?.[0] ?? '',
        product.images?.[1] ?? '',
        product.images?.[2] ?? '',
      ],
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      ...(form.hsnCode.trim() ? { hsnCode: form.hsnCode.trim() } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      images: form.images.filter((url) => url.trim() !== ''),
    };

    let result;

    if (editingProduct) {
      result = await apiClient.patch<Product>(
        `/api/products/${editingProduct.id}`,
        payload,
      );
    } else {
      result = await apiClient.post<Product>('/api/products', payload);
    }

    if (result.success) {
      showToast(
        editingProduct
          ? 'Product updated successfully'
          : 'Product created successfully',
        'success',
      );
      closeModal();
      fetchData(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  function openDeleteDialog(product: Product) {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeletingProduct(null);
  }

  async function handleDelete() {
    if (!deletingProduct || deleting) return;

    setDeleting(true);

    const result = await apiClient.delete<unknown>(
      `/api/products/${deletingProduct.id}`,
    );

    if (result.success) {
      showToast('Product deleted successfully', 'success');
      closeDeleteDialog();
      // Go back to page 1 if deleting the only item on a page
      const newPage =
        products.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;
      fetchData(newPage);
    } else {
      showToast(result.message, 'error');
    }

    setDeleting(false);
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>

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
            Create Product
          </button>
        )}
      </div>

      {/* Table area */}
      <div className="overflow-x-auto">
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
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  HSN Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : products.length === 0 ? (
                /* Empty state */
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-500">
                    No products found. Create your first product.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {product.images?.length > 0 && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-8 h-8 object-cover rounded border border-gray-200 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {product.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {getCategoryName(product.categoryId)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.hsnCode ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Options link — always visible */}
                        <Link
                          href={`/products/${product.id}/options`}
                          className="px-3 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md
                            hover:bg-indigo-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                        >
                          Options
                        </Link>

                        {/* Manager / Owner only */}
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md
                                hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(product)}
                              className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-md
                                hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
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
      {/* Create / Edit Modal                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Create Product'}
      >
        <form onSubmit={handleSubmit} noValidate aria-label={editingProduct ? 'Edit product form' : 'Create product form'}>
          {/* Name */}
          <div className="mb-4">
            <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="product-name"
              type="text"
              required
              disabled={submitting}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="Product name"
              aria-required="true"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="product-category"
              required
              disabled={submitting}
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              aria-required="true"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* HSN Code (optional) */}
          <div className="mb-4">
            <label htmlFor="product-hsn" className="block text-sm font-medium text-gray-700 mb-1">
              HSN Code <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="product-hsn"
              type="text"
              disabled={submitting}
              value={form.hsnCode}
              onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. 8471"
            />
          </div>

          {/* Description (optional) */}
          <div className="mb-4">
            <label htmlFor="product-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              id="product-description"
              rows={3}
              disabled={submitting}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50 resize-none"
              placeholder="Brief product description"
            />
          </div>

          {/* Product Images (up to 3) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Product Images <span className="text-xs text-gray-400">(up to 3, max 2MB each)</span>
            </label>
            <div className="space-y-3">
              {([0, 1, 2] as const).map((idx) => (
                <ImageUpload
                  key={idx}
                  label={`Image ${idx + 1}`}
                  value={form.images[idx] ?? ''}
                  onChange={(url: string) => {
                    const updated = [...form.images];
                    updated[idx] = url;
                    setForm((f) => ({ ...f, images: updated }));
                  }}
                  disabled={submitting}
                />
              ))}
            </div>
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
              disabled={submitting || !form.name.trim() || !form.categoryId}
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
              {editingProduct ? (submitting ? 'Saving…' : 'Save Changes') : (submitting ? 'Creating…' : 'Create Product')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirm Dialog                                                */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Product"
        description={
          deletingProduct
            ? `Are you sure you want to delete "${deletingProduct.name}"? This action cannot be undone.`
            : ''
        }
        onConfirm={handleDelete}
        onCancel={closeDeleteDialog}
      />
    </div>
  );
}
