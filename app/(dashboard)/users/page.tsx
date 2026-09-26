'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import { usePaginatedResource } from '@/hooks/usePaginatedResource';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserFormData {
  name: string;
  email: string;
  password: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
}

interface EditUserFormData {
  name: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Auth
  const [currentUserId] = useState<string | null>(() => {
    const user = getUser();
    return user?.role === 'OWNER' ? user.userId : null;
  });
  const [authorized] = useState(() => getUser()?.role === 'OWNER');

  const buildUrl = useCallback(
    (page: number, limit: number) => `/api/users?page=${page}&limit=${limit}`,
    []
  );

  const {
    data: users,
    pagination,
    loading,
    error,
    fetchPage: fetchUsers,
  } = usePaginatedResource<User>({
    buildUrl,
    limit: 10,
    enabled: authorized,
  });

  // UI state
  const [submitting, setSubmitting] = useState(false);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
  });

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditUserFormData>({
    name: '',
    role: 'STAFF',
  });

  // Confirm dialog state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!authorized) {
      router.replace('/');
    }
  }, [authorized, router]);

  // Don't render content until role is confirmed
  if (!authorized) return null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handlePageChange(page: number) {
    fetchUsers(page);
  }

  function handleRetry() {
    fetchUsers(pagination.page);
  }

  // Create modal
  function openCreateModal() {
    setCreateForm({ name: '', email: '', password: '', role: 'STAFF' });
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setCreateForm({ name: '', email: '', password: '', role: 'STAFF' });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (!createForm.email.trim()) {
      showToast('Email is required', 'error');
      return;
    }
    if (!createForm.password.trim()) {
      showToast('Password is required', 'error');
      return;
    }

    setSubmitting(true);

    const result = await apiClient.post<User>('/api/users', {
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      role: createForm.role,
    });

    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('User created successfully', 'success');
      closeCreateModal();
      fetchUsers(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  // Edit modal
  function openEditModal(user: User) {
    setEditingUser(user);
    setEditForm({ name: user.name, role: user.role });
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditingUser(null);
    setEditForm({ name: '', role: 'STAFF' });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    setSubmitting(true);

    const result = await apiClient.patch<User>(`/api/users/${editingUser.id}`, {
      name: editForm.name.trim(),
      role: editForm.role,
    });

    setSubmitting(false);

    if (result.success && 'data' in result) {
      showToast('User updated successfully', 'success');
      closeEditModal();
      fetchUsers(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  // Deactivate (confirm dialog)
  function openConfirmDialog(user: User) {
    setDeactivatingUser(user);
    setIsConfirmDialogOpen(true);
  }

  function closeConfirmDialog() {
    setIsConfirmDialogOpen(false);
    setDeactivatingUser(null);
  }

  async function handleDeactivate() {
    if (!deactivatingUser) return;

    setSubmitting(true);

    const result = await apiClient.delete<void>(`/api/users/${deactivatingUser.id}`);

    setSubmitting(false);

    if (result.success) {
      showToast('User deactivated successfully', 'success');
      closeConfirmDialog();
      fetchUsers(pagination.page);
    } else {
      showToast(result.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatLastLogin(lastLogin: string | null): string {
    if (!lastLogin) return 'Never';
    try {
      return new Date(lastLogin).toLocaleString();
    } catch {
      return 'Never';
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto">
      {/* Card container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Create User
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading state — 5 rows × 6 cols */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex gap-4">
                  <Skeleton className="h-10 flex-1 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No users found.</p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && users.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Email
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Role
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Last Login
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {user.role}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={user.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatLastLogin(user.lastLogin)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            >
                              Edit
                            </button>
                            {user.id !== currentUserId && (
                              <button
                                type="button"
                                onClick={() => openConfirmDialog(user)}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create User">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="create-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="create-name"
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="create-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="create-email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="create-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="create-password"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="create-role"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="create-role"
              value={createForm.role}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  role: e.target.value as 'OWNER' | 'MANAGER' | 'STAFF',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="OWNER">OWNER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="STAFF">STAFF</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title="Edit User">
        <form onSubmit={handleEdit} className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="edit-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="edit-role"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="edit-role"
              value={editForm.role}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  role: e.target.value as 'OWNER' | 'MANAGER' | 'STAFF',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="OWNER">OWNER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="STAFF">STAFF</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        title="Deactivate User"
        description={`Are you sure you want to deactivate "${deactivatingUser?.name}"? They will no longer be able to log in.`}
        onConfirm={handleDeactivate}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}
