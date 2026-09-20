'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUser, type UserRole } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Skeleton from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { validateForm, validateNumericRange, validateQuantityMatch, clearFieldError, type ValidationError } from '@/lib/form-validation';
import type { ProductionBatchWithProduct } from '@/types/production-batch';
import type { Expense } from '@/types/expense';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TransitionAction = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// ---------------------------------------------------------------------------
// Spinner component
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { showToast } = useToast();

  // Auth
  const [role] = useState<UserRole | null>(() => getUser()?.role ?? null);
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [batch, setBatch] = useState<ProductionBatchWithProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition state
  const [transitioning, setTransitioning] = useState(false);
  const [activeTransition, setActiveTransition] = useState<TransitionAction | null>(null);

  // Cancel confirmation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    plannedQuantity: '',
    producedQuantity: '',
    goodQuantity: '',
    rejectedQuantity: '',
    notes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editValidationErrors, setEditValidationErrors] = useState<ValidationError[]>([]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesPagination, setExpensesPagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchBatch() {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<ProductionBatchWithProduct>(
      `/api/production-batches/${id}`
    );

    if (result.success) {
      setBatch(result.data);
    } else {
      setError(result.message);
    }

    setLoading(false);
  }

  async function fetchExpenses(page = 1) {
    setExpensesLoading(true);
    setExpensesError(null);

    const result = await apiClient.get<Expense[]>(
      `/api/production-batches/${id}/expenses?page=${page}&limit=20`
    );

    if (result.success) {
      setExpenses(result.data);
      if (result.pagination) setExpensesPagination(result.pagination);
    } else {
      setExpensesError(result.message);
    }

    setExpensesLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBatch();
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------------------------------------------------------------------
  // Status transition handler
  // ---------------------------------------------------------------------------

  async function handleTransition(newStatus: TransitionAction) {
    if (transitioning || !batch) return;
    setTransitioning(true);
    setActiveTransition(newStatus);

    const result = await apiClient.patch<ProductionBatchWithProduct>(
      `/api/production-batches/${id}`,
      { status: newStatus }
    );

    if (result.success) {
      showToast(
        newStatus === 'IN_PROGRESS'
          ? 'Production started successfully'
          : newStatus === 'COMPLETED'
          ? 'Batch completed successfully'
          : 'Batch cancelled successfully',
        'success'
      );
      fetchBatch();
    } else {
      showToast(result.message, 'error');
    }

    setTransitioning(false);
    setActiveTransition(null);
  }

  function handleCancelConfirm() {
    setCancelDialogOpen(false);
    handleTransition('CANCELLED');
  }

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  function openEditModal() {
    if (!batch) return;
    setEditForm({
      plannedQuantity: String(batch.plannedQuantity),
      producedQuantity: String(batch.producedQuantity),
      goodQuantity: String(batch.goodQuantity),
      rejectedQuantity: String(batch.rejectedQuantity),
      notes: '',
    });
    setEditValidationErrors([]);
    setEditModalOpen(true);
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditForm({
      plannedQuantity: '',
      producedQuantity: '',
      goodQuantity: '',
      rejectedQuantity: '',
      notes: '',
    });
    setEditValidationErrors([]);
  }

  function getEditFieldError(field: string): string | undefined {
    return editValidationErrors.find((e) => e.field === field)?.message;
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!batch) return;

    // Validate
    const plannedNum = parseInt(editForm.plannedQuantity, 10);
    const producedNum = parseInt(editForm.producedQuantity, 10);
    const goodNum = parseInt(editForm.goodQuantity, 10);
    const rejectedNum = parseInt(editForm.rejectedQuantity, 10);

    const errors = validateForm([
      validateNumericRange(editForm.plannedQuantity, 'plannedQuantity', 'Planned quantity', 1, 999999),
      validateNumericRange(editForm.producedQuantity, 'producedQuantity', 'Produced quantity', 0, 999999),
      validateNumericRange(editForm.goodQuantity, 'goodQuantity', 'Good quantity', 0, 999999),
      validateNumericRange(editForm.rejectedQuantity, 'rejectedQuantity', 'Rejected quantity', 0, 999999),
      // Cross-field: only when all three are valid numbers and produced > 0
      !isNaN(producedNum) && !isNaN(goodNum) && !isNaN(rejectedNum) && producedNum > 0
        ? validateQuantityMatch(producedNum, goodNum, rejectedNum)
        : null,
      // Notes length validation
      editForm.notes.length > 1000
        ? { field: 'notes', message: 'Notes must be 1000 characters or fewer' }
        : null,
    ]);

    if (errors.length > 0) {
      setEditValidationErrors(errors);
      return;
    }

    // Build payload with only changed fields
    const payload: Record<string, unknown> = {};
    if (plannedNum !== batch.plannedQuantity) payload.plannedQuantity = plannedNum;
    if (producedNum !== batch.producedQuantity) payload.producedQuantity = producedNum;
    if (goodNum !== batch.goodQuantity) payload.goodQuantity = goodNum;
    if (rejectedNum !== batch.rejectedQuantity) payload.rejectedQuantity = rejectedNum;
    if (editForm.notes.trim()) payload.notes = editForm.notes.trim();

    if (Object.keys(payload).length === 0) {
      showToast('No changes to save', 'success');
      closeEditModal();
      return;
    }

    setEditSubmitting(true);

    const result = await apiClient.patch<ProductionBatchWithProduct>(
      `/api/production-batches/${id}`,
      payload
    );

    if (result.success) {
      showToast('Batch updated successfully', 'success');
      closeEditModal();
      fetchBatch();
    } else {
      showToast(result.message, 'error');
    }

    setEditSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  async function handleDeleteConfirm() {
    if (!batch) return;
    setDeleting(true);
    setDeleteDialogOpen(false);

    const result = await apiClient.delete<unknown>(`/api/production-batches/${id}`);

    if (result.success) {
      showToast('Batch deleted successfully', 'success');
      router.push('/production-batches');
    } else {
      // 409 conflict or other error — both show error toast
      showToast(result.message, 'error');
    }

    setDeleting(false);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  }

  function formatCost(value: string | null): string {
    if (!value) return '—';
    return `₹${parseFloat(value).toFixed(2)}`;
  }

  function formatCostPerUnit(value: string | null): string {
    if (!value) return '—';
    return `₹${parseFloat(value).toFixed(4)}`;
  }

  // ---------------------------------------------------------------------------
  // Render — loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        {/* Back link skeleton */}
        <Skeleton className="h-5 w-40 rounded" />

        {/* Detail card skeleton */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-5 w-32 rounded" />
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — error
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => router.push('/production-batches')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Production Batches
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchBatch}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!batch) return null;

  // ---------------------------------------------------------------------------
  // Render — detail
  // ---------------------------------------------------------------------------

  const isDraft = batch.status === 'DRAFT';
  const isInProgress = batch.status === 'IN_PROGRESS';
  const isCompleted = batch.status === 'COMPLETED';

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.push('/production-batches')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Production Batches
      </button>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header with title, status badge, and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between px-6 py-4 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{batch.batchNumber}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {batch.productName}
              {batch.skuCode && (
                <span className="ml-2 text-gray-400">({batch.skuCode})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={batch.status} />

            {/* Action buttons — only for MANAGER/OWNER */}
            {canManage && (
              <>
                {/* Edit button — visible for DRAFT or IN_PROGRESS */}
                {(isDraft || isInProgress) && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg
                      hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  >
                    Edit
                  </button>
                )}

                {/* Delete button — visible for DRAFT only */}
                {isDraft && (
                  <button
                    type="button"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg
                      hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}

                {isDraft && (
                  <button
                    type="button"
                    onClick={() => handleTransition('IN_PROGRESS')}
                    disabled={transitioning}
                    aria-busy={activeTransition === 'IN_PROGRESS'}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg
                      hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeTransition === 'IN_PROGRESS' && <Spinner />}
                    Start Production
                  </button>
                )}

                {isInProgress && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTransition('COMPLETED')}
                      disabled={transitioning}
                      aria-busy={activeTransition === 'COMPLETED'}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg
                        hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeTransition === 'COMPLETED' && <Spinner />}
                      Complete Batch
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={transitioning}
                      aria-busy={activeTransition === 'CANCELLED'}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg
                        hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeTransition === 'CANCELLED' && <Spinner />}
                      Cancel Batch
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Batch detail fields */}
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Batch Number</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.batchNumber}</p>
          </div>
          <div>
            <p className="text-gray-500">Product</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.productName}</p>
          </div>
          <div>
            <p className="text-gray-500">SKU</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.skuCode ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p className="mt-0.5">
              <StatusBadge status={batch.status} />
            </p>
          </div>
          <div>
            <p className="text-gray-500">Planned Quantity</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.plannedQuantity}</p>
          </div>
          <div>
            <p className="text-gray-500">Produced Quantity</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.producedQuantity}</p>
          </div>
          <div>
            <p className="text-gray-500">Good Quantity</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.goodQuantity}</p>
          </div>
          <div>
            <p className="text-gray-500">Rejected Quantity</p>
            <p className="font-medium text-gray-900 mt-0.5">{batch.rejectedQuantity}</p>
          </div>
          <div>
            <p className="text-gray-500">Start Date</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(batch.startDate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Completion Date</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(batch.completionDate)}</p>
          </div>
        </div>

        {/* Cost Breakdown — only for COMPLETED batches */}
        {isCompleted && (
          <div className="px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Material Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.materialCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Labour Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.labourCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Packaging Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.packagingCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Overhead Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.overheadCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Transport Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.transportCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Other Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.otherCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Manufacturing Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCost(batch.totalManufacturingCost)}</p>
              </div>
              <div>
                <p className="text-gray-500">Cost Per Unit</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCostPerUnit(batch.costPerUnit)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Expenses Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Batch Expenses</h2>
        </div>
        <div className="overflow-x-auto" aria-busy={expensesLoading} aria-live="polite">
          {expensesError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-sm text-red-600">{expensesError}</p>
              <button
                type="button"
                onClick={() => fetchExpenses(expensesPagination.page)}
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
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Include in Mfg Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {expensesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-500">
                      No expenses linked
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{expense.name}</td>
                      <td className="px-4 py-3 text-gray-600">{expense.category}</td>
                      <td className="px-4 py-3 text-gray-600">₹{parseFloat(expense.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(expense.expenseDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {expense.includeInManufacturingCost ? (
                          <span className="text-sm font-medium text-green-600">Yes</span>
                        ) : (
                          <span className="text-sm font-medium text-gray-500">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        {!expensesLoading && !expensesError && expensesPagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <Pagination
              page={expensesPagination.page}
              totalPages={expensesPagination.totalPages}
              onPageChange={fetchExpenses}
            />
          </div>
        )}
      </div>

      {/* Confirm cancel dialog */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        title="Cancel Batch"
        description={`Are you sure you want to cancel batch "${batch.batchNumber}"? This action cannot be undone.`}
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelDialogOpen(false)}
      />

      {/* Edit Modal */}
      <Modal isOpen={editModalOpen} onClose={closeEditModal} title="Edit Batch">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {/* Planned Quantity */}
          <div>
            <label htmlFor="edit-plannedQuantity" className="block text-sm font-medium text-gray-700 mb-1">
              Planned Quantity
            </label>
            <input
              id="edit-plannedQuantity"
              type="number"
              min={1}
              max={999999}
              aria-required="true"
              value={editForm.plannedQuantity}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, plannedQuantity: e.target.value }));
                setEditValidationErrors((errs) => clearFieldError(errs, 'plannedQuantity'));
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                getEditFieldError('plannedQuantity') ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {getEditFieldError('plannedQuantity') && (
              <p className="mt-1 text-xs text-red-600">{getEditFieldError('plannedQuantity')}</p>
            )}
          </div>

          {/* Produced Quantity */}
          <div>
            <label htmlFor="edit-producedQuantity" className="block text-sm font-medium text-gray-700 mb-1">
              Produced Quantity
            </label>
            <input
              id="edit-producedQuantity"
              type="number"
              min={0}
              max={999999}
              value={editForm.producedQuantity}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, producedQuantity: e.target.value }));
                setEditValidationErrors((errs) => clearFieldError(errs, 'producedQuantity'));
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                getEditFieldError('producedQuantity') ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {getEditFieldError('producedQuantity') && (
              <p className="mt-1 text-xs text-red-600">{getEditFieldError('producedQuantity')}</p>
            )}
          </div>

          {/* Good Quantity */}
          <div>
            <label htmlFor="edit-goodQuantity" className="block text-sm font-medium text-gray-700 mb-1">
              Good Quantity
            </label>
            <input
              id="edit-goodQuantity"
              type="number"
              min={0}
              max={999999}
              value={editForm.goodQuantity}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, goodQuantity: e.target.value }));
                setEditValidationErrors((errs) => clearFieldError(errs, 'goodQuantity'));
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                getEditFieldError('goodQuantity') ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {getEditFieldError('goodQuantity') && (
              <p className="mt-1 text-xs text-red-600">{getEditFieldError('goodQuantity')}</p>
            )}
          </div>

          {/* Rejected Quantity */}
          <div>
            <label htmlFor="edit-rejectedQuantity" className="block text-sm font-medium text-gray-700 mb-1">
              Rejected Quantity
            </label>
            <input
              id="edit-rejectedQuantity"
              type="number"
              min={0}
              max={999999}
              value={editForm.rejectedQuantity}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, rejectedQuantity: e.target.value }));
                setEditValidationErrors((errs) => clearFieldError(errs, 'rejectedQuantity'));
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                getEditFieldError('rejectedQuantity') ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {getEditFieldError('rejectedQuantity') && (
              <p className="mt-1 text-xs text-red-600">{getEditFieldError('rejectedQuantity')}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="edit-notes"
              maxLength={1000}
              rows={3}
              value={editForm.notes}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, notes: e.target.value }));
                setEditValidationErrors((errs) => clearFieldError(errs, 'notes'));
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                getEditFieldError('notes') ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {getEditFieldError('notes') && (
              <p className="mt-1 text-xs text-red-600">{getEditFieldError('notes')}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Batch"
        description={`Are you sure you want to delete batch "${batch.batchNumber}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
