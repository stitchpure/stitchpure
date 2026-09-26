'use client';

import { useCallback, useState } from 'react';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import ImageUpload from '@/components/ui/ImageUpload';
import { usePaginatedResource } from '@/hooks/usePaginatedResource';

interface Category {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFormData {
  name: string;
  parentId: string;
  description: string;
  bannerImage: string;
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  parentId: '',
  description: '',
  bannerImage: '',
};

export default function CategoriesPage() {
  const { showToast } = useToast();

  const [role] = useState<'OWNER' | 'MANAGER' | 'STAFF'>(() => getUser()?.role ?? 'STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  const buildUrl = useCallback(
    (page: number, limit: number) => `/api/categories?page=${page}&limit=${limit}`,
    []
  );

  const {
    data: categories,
    pagination,
    loading,
    error,
    fetchPage: fetchCategories,
  } = usePaginatedResource<Category>({ buildUrl, limit: 10 });

  const [submitting, setSubmitting] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreateModal() {
    setFormData(EMPTY_FORM);
    setIsCreateModalOpen(true);
  }
  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setFormData(EMPTY_FORM);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      parentId: category.parentId ?? '',
      description: category.description ?? '',
      bannerImage: category.bannerImage ?? '',
    });
    setIsEditModalOpen(true);
  }
  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
  }

  function openConfirmDialog(category: Category) {
    setDeletingCategory(category);
    setIsConfirmDialogOpen(true);
  }
  function closeConfirmDialog() {
    setIsConfirmDialogOpen(false);
    setDeletingCategory(null);
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formData.name.trim()) { showToast('Category name is required', 'error'); return; }
    setSubmitting(true);

    const payload: Record<string, unknown> = { name: formData.name.trim() };
    if (formData.parentId) payload.parentId = formData.parentId;
    if (formData.description.trim()) payload.description = formData.description.trim();
    payload.bannerImage = formData.bannerImage.trim() || null;

    const result = await apiClient.post<Category>('/api/categories', payload);
    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('Category created successfully', 'success');
      closeCreateModal();
      fetchCategories(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingCategory) return;
    if (!formData.name.trim()) { showToast('Category name is required', 'error'); return; }
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      parentId: formData.parentId || null,
      description: formData.description.trim() || null,
      bannerImage: formData.bannerImage.trim() || null,
    };

    const result = await apiClient.patch<Category>(`/api/categories/${editingCategory.id}`, payload);
    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('Category updated successfully', 'success');
      closeEditModal();
      fetchCategories(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  async function handleDelete() {
    if (!deletingCategory) return;
    setSubmitting(true);
    const result = await apiClient.delete<void>(`/api/categories/${deletingCategory.id}`);
    setSubmitting(false);

    if (result.success) {
      showToast('Category deleted successfully', 'success');
      closeConfirmDialog();
      fetchCategories(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  function getCategoryNameById(id: string | null): string {
    if (!id) return '—';
    return categories.find((c) => c.id === id)?.name ?? '—';
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Categories</h1>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Create Category
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex gap-4">
                  <Skeleton className="h-10 w-1/4 rounded" />
                  <Skeleton className="h-10 w-1/4 rounded" />
                  <Skeleton className="h-10 w-1/4 rounded" />
                  <Skeleton className="h-10 w-1/4 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button type="button" onClick={() => fetchCategories(pagination.page)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && categories.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No categories found. Create your first category.</p>
            </div>
          )}

          {!loading && !error && categories.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Parent Category</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                      {canManage && (
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            {category.bannerImage && (
                              <img
                                src={category.bannerImage}
                                alt={category.name}
                                className="w-8 h-8 object-cover rounded border border-gray-200 shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {category.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getCategoryNameById(category.parentId)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={category.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => openEditModal(category)}
                                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                                Edit
                              </button>
                              <button type="button" onClick={() => openConfirmDialog(category)}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchCategories} />
            </>
          )}
        </div>
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create Category">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input id="create-name" type="text" required value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="create-parent" className="block text-sm font-medium text-gray-700 mb-1">
              Parent Category
            </label>
            <select id="create-parent" value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="create-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea id="create-description" rows={3} value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Banner Image <span className="text-xs text-gray-400">(optional, max 5MB)</span>
            </label>
            <ImageUpload
              label="Category Banner"
              value={formData.bannerImage}
              onChange={(url: string) => setFormData({ ...formData, bannerImage: url })}
              disabled={submitting}
            />
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
      <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title="Edit Category">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input id="edit-name" type="text" required value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>

          <div>
            <label htmlFor="edit-parent" className="block text-sm font-medium text-gray-700 mb-1">
              Parent Category
            </label>
            <select id="edit-parent" value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">None</option>
              {categories.filter((cat) => cat.id !== editingCategory?.id).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea id="edit-description" rows={3} value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Banner Image <span className="text-xs text-gray-400">(optional, max 5MB)</span>
            </label>
            <ImageUpload
              label="Category Banner"
              value={formData.bannerImage}
              onChange={(url: string) => setFormData({ ...formData, bannerImage: url })}
              disabled={submitting}
            />
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
        title="Delete Category"
        description={`Are you sure you want to delete "${deletingCategory?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}
