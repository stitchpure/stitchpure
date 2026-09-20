'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';

import { getUser, type UserRole } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import { validateForm, validateRequired, validateNumericRange, type ValidationError } from '@/lib/form-validation';
import type { Expense, ExpenseCategory } from '@/types/expense';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BatchOption {
  id: string;
  batchNumber: string;
}

interface ExpenseFormData {
  name: string;
  amount: string;
  category: string;
  expenseDate: string;
  productionBatchId: string;
  notes: string;
  includeInManufacturingCost: boolean;
}

const EMPTY_FORM: ExpenseFormData = {
  name: '',
  amount: '',
  category: '',
  expenseDate: '',
  productionBatchId: '',
  notes: '',
  includeInManufacturingCost: true,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'MATERIAL',
  'LABOUR',
  'PACKAGING',
  'OVERHEAD',
  'TRANSPORT',
  'OTHER',
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const { showToast } = useToast();

  // Auth
  const [role] = useState<UserRole | null>(() => getUser()?.role ?? null);
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Batch dropdown options
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchExpenses = useCallback(
    async (page = 1, batchId = batchFilter, category = categoryFilter) => {
      setLoading(true);
      setError(null);

      let url = `/api/expenses?page=${page}&limit=20`;
      if (batchId) {
        url += `&productionBatchId=${batchId}`;
      }
      if (category) {
        url += `&category=${category}`;
      }

      const result = await apiClient.get<Expense[]>(url);

      if (!result.success) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setExpenses(result.data);

      if (result.pagination) {
        setPagination(result.pagination);
      }

      setLoading(false);
    },
    [batchFilter, categoryFilter]
  );

  const fetchBatchOptions = useCallback(async () => {
    const result = await apiClient.get<BatchOption[]>('/api/production-batches');
    if (result.success) {
      setBatchOptions(result.data);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // On mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExpenses(1);
    fetchBatchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Filter handlers
  // ---------------------------------------------------------------------------

  function handleBatchFilterChange(value: string) {
    setBatchFilter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchExpenses(1, value, categoryFilter);
  }

  function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchExpenses(1, batchFilter, value);
  }

  // ---------------------------------------------------------------------------
  // Modal handlers
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setValidationErrors([]);
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    setForm({
      name: expense.name,
      amount: parseFloat(expense.amount).toString(),
      category: expense.category,
      expenseDate: expense.expenseDate.split('T')[0],
      productionBatchId: expense.productionBatchId ?? '',
      notes: expense.notes ?? '',
      includeInManufacturingCost: expense.includeInManufacturingCost,
    });
    setValidationErrors([]);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setValidationErrors([]);
  }

  function getFieldError(field: string): string | undefined {
    return validationErrors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation
    const errors = validateForm([
      validateRequired(form.name, 'name', 'Name'),
      validateRequired(form.amount, 'amount', 'Amount'),
      validateNumericRange(form.amount, 'amount', 'Amount', 0.01, 99999999999999.99),
      validateRequired(form.category, 'category', 'Category'),
      validateRequired(form.expenseDate, 'expenseDate', 'Expense date'),
    ]);

    // Additional name length validation
    if (form.name && form.name.trim().length > 255) {
      errors.push({ field: 'name', message: 'Name must be 255 characters or less' });
    }

    // Additional notes length validation
    if (form.notes && form.notes.length > 2000) {
      errors.push({ field: 'notes', message: 'Notes must be 2000 characters or less' });
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      expenseDate: form.expenseDate,
      productionBatchId: form.productionBatchId || undefined,
      notes: form.notes || undefined,
      includeInManufacturingCost: form.includeInManufacturingCost,
    };

    if (editingExpense) {
      // Edit flow
      const result = await apiClient.patch<Expense>(`/api/expenses/${editingExpense.id}`, payload);

      if (result.success) {
        showToast('Expense updated successfully', 'success');
        closeModal();
        fetchExpenses(pagination.page);
      } else {
        showToast(result.message, 'error');
      }
    } else {
      // Create flow
      const result = await apiClient.post<Expense>('/api/expenses', payload);

      if (result.success) {
        showToast('Expense created successfully', 'success');
        closeModal();
        fetchExpenses(pagination.page);
      } else {
        showToast(result.message, 'error');
      }
    }

    setSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Delete handlers
  // ---------------------------------------------------------------------------

  function openDeleteConfirm(expense: Expense) {
    setDeleteTarget(expense);
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    setDeleteTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    const result = await apiClient.delete<unknown>(`/api/expenses/${deleteTarget.id}`);

    if (result.success) {
      showToast('Expense deleted successfully', 'success');
      setDeleteTarget(null);
      fetchExpenses(pagination.page);
    } else {
      showToast(result.message, 'error');
    }

    setDeleting(false);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const columnCount = canManage ? 7 : 6;

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100">
        {Array.from({ length: columnCount }).map((__, j) => (
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
        <h1 className="text-xl font-semibold text-gray-900">Expenses</h1>

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
            Create Expense
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
        {/* Batch filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-batch" className="text-sm font-medium text-gray-600">
            Batch:
          </label>
          <select
            id="filter-batch"
            value={batchFilter}
            onChange={(e) => handleBatchFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Batches</option>
            {batchOptions.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batchNumber}
              </option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-category" className="text-sm font-medium text-gray-600">
            Category:
          </label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table area */}
      <div className="overflow-x-auto" aria-busy={loading} aria-live="polite">
        {error ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchExpenses(pagination.page)}
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
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Expense Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Linked Batch
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Include in Mfg Cost
                </th>
                {canManage && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : expenses.length === 0 ? (
                /* Empty state */
                <tr>
                  <td colSpan={columnCount} className="px-4 py-16 text-center text-sm text-gray-500">
                    No expenses match the current filter criteria.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {expense.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {expense.category}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {parseFloat(expense.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(expense.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {expense.productionBatchId
                        ? batchOptions.find((b) => b.id === expense.productionBatchId)?.batchNumber ?? '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {expense.includeInManufacturingCost ? 'Yes' : 'No'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(expense)}
                            className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md
                              hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteConfirm(expense)}
                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md
                              hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                          >
                            Delete
                          </button>
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
            onPageChange={(p) => fetchExpenses(p)}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Expense Modal                                         */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingExpense ? 'Edit Expense' : 'Create Expense'}
      >
        <form onSubmit={handleSubmit} noValidate aria-label={editingExpense ? 'Edit expense form' : 'Create expense form'}>
          {/* Name */}
          <div className="mb-4">
            <label htmlFor="expense-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="expense-name"
              type="text"
              maxLength={255}
              disabled={submitting}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. Raw material purchase"
              aria-required="true"
            />
            {getFieldError('name') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('name')}</p>
            )}
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="expense-amount"
              type="number"
              min={0.01}
              max={99999999999999.99}
              step="0.01"
              disabled={submitting}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              placeholder="e.g. 1500.00"
              aria-required="true"
            />
            {getFieldError('amount') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('amount')}</p>
            )}
          </div>

          {/* Category */}
          <div className="mb-4">
            <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="expense-category"
              disabled={submitting}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              aria-required="true"
            >
              <option value="">Select a category</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {getFieldError('category') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('category')}</p>
            )}
          </div>

          {/* Expense Date */}
          <div className="mb-4">
            <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-1">
              Expense Date <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="expense-date"
              type="date"
              disabled={submitting}
              value={form.expenseDate}
              onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
              aria-required="true"
            />
            {getFieldError('expenseDate') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('expenseDate')}</p>
            )}
          </div>

          {/* Production Batch (optional) */}
          <div className="mb-4">
            <label htmlFor="expense-batch" className="block text-sm font-medium text-gray-700 mb-1">
              Production Batch <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <select
              id="expense-batch"
              disabled={submitting}
              value={form.productionBatchId}
              onChange={(e) => setForm((f) => ({ ...f, productionBatchId: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">None</option>
              {batchOptions.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batchNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Notes (optional) */}
          <div className="mb-4">
            <label htmlFor="expense-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-xs text-gray-400">(optional, max 2000 chars)</span>
            </label>
            <textarea
              id="expense-notes"
              maxLength={2000}
              rows={3}
              disabled={submitting}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-gray-50 resize-none"
              placeholder="Optional notes about this expense"
            />
            {getFieldError('notes') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('notes')}</p>
            )}
          </div>

          {/* Include in Manufacturing Cost */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <input
                id="expense-include-mfg"
                type="checkbox"
                disabled={submitting}
                checked={form.includeInManufacturingCost}
                onChange={(e) => setForm((f) => ({ ...f, includeInManufacturingCost: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="expense-include-mfg" className="text-sm font-medium text-gray-700">
                Include in Manufacturing Cost
              </label>
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
              disabled={submitting}
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
              {editingExpense
                ? (submitting ? 'Updating...' : 'Update Expense')
                : (submitting ? 'Creating...' : 'Create Expense')
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Dialog                                           */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Expense"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={closeDeleteConfirm}
      />
    </div>
  );
}
