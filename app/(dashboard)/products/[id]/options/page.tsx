'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductOption {
  id: string;
  productId: string;
  name: string;
  slug: string;
  type: 'TEXT' | 'COLOR' | 'NUMBER';
  isRequired: boolean;
  isVariant: boolean;
  isActive: boolean;
  displayOrder: number;
}

interface OptionValue {
  id: string;
  optionId: string;
  value: string;
  code: string | null;
  colorCode: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface OptionFormData {
  name: string;
  type: 'TEXT' | 'COLOR' | 'NUMBER';
  isRequired: boolean;
  isVariant: boolean;
  displayOrder: string;
}

interface ValueFormData {
  value: string;
  code: string;
  colorCode: string;
  displayOrder: string;
}

// ---------------------------------------------------------------------------
// Helper: type badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: 'TEXT' | 'COLOR' | 'NUMBER' }) {
  const styles: Record<string, string> = {
    TEXT: 'bg-blue-50 text-blue-700',
    COLOR: 'bg-purple-50 text-purple-700',
    NUMBER: 'bg-orange-50 text-orange-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${styles[type]}`}>
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Default form states
// ---------------------------------------------------------------------------

const defaultOptionForm: OptionFormData = {
  name: '',
  type: 'TEXT',
  isRequired: false,
  isVariant: false,
  displayOrder: '0',
};

const defaultValueForm: ValueFormData = {
  value: '',
  code: '',
  colorCode: '',
  displayOrder: '0',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductOptionsPage() {
  const { id: productId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  // Auth
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF');
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Options list
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded accordion state
  const [expandedOptionIds, setExpandedOptionIds] = useState<Set<string>>(new Set());

  // Per-option values (cached after first load)
  const [optionValues, setOptionValues] = useState<Record<string, OptionValue[]>>({});
  const [loadingValues, setLoadingValues] = useState<Record<string, boolean>>({});

  // Submitting flag (shared across all mutations)
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Option modal/confirm state
  // ---------------------------------------------------------------------------
  const [isAddOptionModalOpen, setIsAddOptionModalOpen] = useState(false);
  const [isEditOptionModalOpen, setIsEditOptionModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);
  const [isDeleteOptionDialogOpen, setIsDeleteOptionDialogOpen] = useState(false);
  const [deletingOption, setDeletingOption] = useState<ProductOption | null>(null);
  const [optionForm, setOptionForm] = useState<OptionFormData>(defaultOptionForm);

  // ---------------------------------------------------------------------------
  // Value modal/confirm state
  // ---------------------------------------------------------------------------
  const [isAddValueModalOpen, setIsAddValueModalOpen] = useState(false);
  const [isEditValueModalOpen, setIsEditValueModalOpen] = useState(false);
  const [isDeleteValueDialogOpen, setIsDeleteValueDialogOpen] = useState(false);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<OptionValue | null>(null);
  const [deletingValue, setDeletingValue] = useState<OptionValue | null>(null);
  const [valueForm, setValueForm] = useState<ValueFormData>(defaultValueForm);

  // ---------------------------------------------------------------------------
  // Fetch options
  // ---------------------------------------------------------------------------

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiClient.get<ProductOption[]>(
      `/api/products/${productId}/options`
    );
    if (result.success && 'data' in result) {
      setOptions(result.data);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, [productId]);

  // ---------------------------------------------------------------------------
  // Fetch values for a given option (lazy, cached)
  // ---------------------------------------------------------------------------

  async function fetchValues(optionId: string) {
    if (optionValues[optionId] !== undefined) return; // already cached
    setLoadingValues((prev) => ({ ...prev, [optionId]: true }));
    const result = await apiClient.get<OptionValue[]>(
      `/api/products/${productId}/options/${optionId}/values`
    );
    if (result.success && 'data' in result) {
      setOptionValues((prev) => ({ ...prev, [optionId]: result.data }));
    } else {
      // Store empty so we don't retry silently; user can re-expand
      setOptionValues((prev) => ({ ...prev, [optionId]: [] }));
      showToast(result.message, 'error');
    }
    setLoadingValues((prev) => ({ ...prev, [optionId]: false }));
  }

  async function refetchValues(optionId: string) {
    setLoadingValues((prev) => ({ ...prev, [optionId]: true }));
    const result = await apiClient.get<OptionValue[]>(
      `/api/products/${productId}/options/${optionId}/values`
    );
    if (result.success && 'data' in result) {
      setOptionValues((prev) => ({ ...prev, [optionId]: result.data }));
    }
    setLoadingValues((prev) => ({ ...prev, [optionId]: false }));
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const user = getUser();
    if (user) setRole(user.role);
    fetchOptions();
  }, [fetchOptions]);

  // ---------------------------------------------------------------------------
  // Accordion toggle
  // ---------------------------------------------------------------------------

  function toggleOption(optionId: string) {
    setExpandedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
        fetchValues(optionId);
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Option handlers — Add
  // ---------------------------------------------------------------------------

  function openAddOptionModal() {
    setOptionForm(defaultOptionForm);
    setIsAddOptionModalOpen(true);
  }

  function closeAddOptionModal() {
    setIsAddOptionModalOpen(false);
    setOptionForm(defaultOptionForm);
  }

  async function handleAddOption(e: React.FormEvent) {
    e.preventDefault();
    if (!optionForm.name.trim()) {
      showToast('Option name is required', 'error');
      return;
    }
    setSubmitting(true);
    const result = await apiClient.post<ProductOption>(
      `/api/products/${productId}/options`,
      {
        name: optionForm.name.trim(),
        type: optionForm.type,
        isRequired: optionForm.isRequired,
        isVariant: optionForm.isVariant,
        displayOrder: Number(optionForm.displayOrder) || 0,
      }
    );
    setSubmitting(false);
    if (result.success && 'data' in result) {
      showToast('Option added successfully', 'success');
      closeAddOptionModal();
      fetchOptions();
    } else {
      showToast(result.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Option handlers — Edit
  // ---------------------------------------------------------------------------

  function openEditOptionModal(option: ProductOption) {
    setEditingOption(option);
    setOptionForm({
      name: option.name,
      type: option.type,
      isRequired: option.isRequired,
      isVariant: option.isVariant,
      displayOrder: String(option.displayOrder),
    });
    setIsEditOptionModalOpen(true);
  }

  function closeEditOptionModal() {
    setIsEditOptionModalOpen(false);
    setEditingOption(null);
    setOptionForm(defaultOptionForm);
  }

  async function handleEditOption(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOption) return;
    if (!optionForm.name.trim()) {
      showToast('Option name is required', 'error');
      return;
    }
    setSubmitting(true);
    const result = await apiClient.patch<ProductOption>(
      `/api/products/${productId}/options/${editingOption.id}`,
      {
        name: optionForm.name.trim(),
        type: optionForm.type,
        isRequired: optionForm.isRequired,
        isVariant: optionForm.isVariant,
        displayOrder: Number(optionForm.displayOrder) || 0,
      }
    );
    setSubmitting(false);
    if (result.success && 'data' in result) {
      showToast('Option updated successfully', 'success');
      closeEditOptionModal();
      fetchOptions();
    } else {
      showToast(result.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Option handlers — Delete
  // ---------------------------------------------------------------------------

  function openDeleteOptionDialog(option: ProductOption) {
    setDeletingOption(option);
    setIsDeleteOptionDialogOpen(true);
  }

  function closeDeleteOptionDialog() {
    setIsDeleteOptionDialogOpen(false);
    setDeletingOption(null);
  }

  async function handleDeleteOption() {
    if (!deletingOption) return;
    setSubmitting(true);
    const result = await apiClient.delete<void>(
      `/api/products/${productId}/options/${deletingOption.id}`
    );
    setSubmitting(false);
    if (result.success) {
      showToast('Option deleted successfully', 'success');
      closeDeleteOptionDialog();
      // Remove from expanded + cached values
      setExpandedOptionIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingOption.id);
        return next;
      });
      setOptionValues((prev) => {
        const next = { ...prev };
        delete next[deletingOption.id];
        return next;
      });
      fetchOptions();
    } else {
      showToast(result.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Value handlers — Add
  // ---------------------------------------------------------------------------

  function openAddValueModal(optionId: string) {
    setActiveOptionId(optionId);
    setValueForm(defaultValueForm);
    setIsAddValueModalOpen(true);
  }

  function closeAddValueModal() {
    setIsAddValueModalOpen(false);
    setActiveOptionId(null);
    setValueForm(defaultValueForm);
  }

  async function handleAddValue(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOptionId) return;
    if (!valueForm.value.trim()) {
      showToast('Value is required', 'error');
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      value: valueForm.value.trim(),
      displayOrder: Number(valueForm.displayOrder) || 0,
    };
    if (valueForm.code.trim()) payload.code = valueForm.code.trim();
    if (valueForm.colorCode.trim()) payload.colorCode = valueForm.colorCode.trim();

    const result = await apiClient.post<OptionValue>(
      `/api/products/${productId}/options/${activeOptionId}/values`,
      payload
    );
    setSubmitting(false);
    if (result.success && 'data' in result) {
      showToast('Value added successfully', 'success');
      closeAddValueModal();
      refetchValues(activeOptionId);
    } else {
      showToast(result.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Value handlers — Edit
  // ---------------------------------------------------------------------------

  function openEditValueModal(optionId: string, value: OptionValue) {
    setActiveOptionId(optionId);
    setEditingValue(value);
    setValueForm({
      value: value.value,
      code: value.code ?? '',
      colorCode: value.colorCode ?? '',
      displayOrder: String(value.displayOrder),
    });
    setIsEditValueModalOpen(true);
  }

  function closeEditValueModal() {
    setIsEditValueModalOpen(false);
    setActiveOptionId(null);
    setEditingValue(null);
    setValueForm(defaultValueForm);
  }

  async function handleEditValue(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOptionId || !editingValue) return;
    if (!valueForm.value.trim()) {
      showToast('Value is required', 'error');
      return;
    }
    setSubmitting(true);
    const result = await apiClient.patch<OptionValue>(
      `/api/products/${productId}/options/${activeOptionId}/values/${editingValue.id}`,
      {
        value: valueForm.value.trim(),
        code: valueForm.code.trim() || null,
        colorCode: valueForm.colorCode.trim() || null,
        displayOrder: Number(valueForm.displayOrder) || 0,
      }
    );
    setSubmitting(false);
    if (result.success && 'data' in result) {
      showToast('Value updated successfully', 'success');
      const oid = activeOptionId;
      closeEditValueModal();
      refetchValues(oid);
    } else {
      showToast(result.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Value handlers — Delete
  // ---------------------------------------------------------------------------

  function openDeleteValueDialog(optionId: string, value: OptionValue) {
    setActiveOptionId(optionId);
    setDeletingValue(value);
    setIsDeleteValueDialogOpen(true);
  }

  function closeDeleteValueDialog() {
    setIsDeleteValueDialogOpen(false);
    setActiveOptionId(null);
    setDeletingValue(null);
  }

  async function handleDeleteValue() {
    if (!activeOptionId || !deletingValue) return;
    setSubmitting(true);
    const result = await apiClient.delete<void>(
      `/api/products/${productId}/options/${activeOptionId}/values/${deletingValue.id}`
    );
    setSubmitting(false);
    if (result.success) {
      showToast('Value deleted successfully', 'success');
      const oid = activeOptionId;
      closeDeleteValueDialog();
      refetchValues(oid);
    } else {
      showToast(result.message, 'error');
    }
  }

  // OptionFormFields and ValueFormFields are intentionally inlined in the
  // modal JSX below — defining them as inner functions here would cause React
  // to treat them as new component types on every render, unmounting the
  // inputs on each keystroke and losing focus.

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link + page heading */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/products"
          className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
        >
          ← Back to Products
        </Link>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Product Options</h1>
          {canManage && !loading && !error && (
            <button
              type="button"
              onClick={openAddOptionModal}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Add Option
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={fetchOptions}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && options.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">
                No options yet. Add your first option.
              </p>
            </div>
          )}

          {/* Options accordion */}
          {!loading && !error && options.length > 0 && (
            <div className="space-y-3">
              {options.map((option) => {
                const isExpanded = expandedOptionIds.has(option.id);
                const values = optionValues[option.id] ?? [];
                const loadingVals = loadingValues[option.id] ?? false;

                return (
                  <div
                    key={option.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Option header row */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                      {/* Left: name + badges */}
                      <div className="flex items-center flex-wrap min-w-0" style={{ gap: '8px' }}>
                        <span className="text-sm font-medium text-gray-900 shrink-0">{option.name}</span>
                        <span className="shrink-0"><TypeBadge type={option.type} /></span>
                        {option.isRequired && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 shrink-0">
                            Required
                          </span>
                        )}
                        {option.isVariant && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 shrink-0">
                            Variant
                          </span>
                        )}
                        <span className="text-xs text-gray-400 shrink-0">
                          Order: {option.displayOrder}
                        </span>
                      </div>

                      {/* Right: action buttons + expand toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditOptionModal(option); }}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openDeleteOptionDialog(option); }}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleOption(option.id)}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          className="p-1.5 text-gray-500 rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded: values section */}
                    {isExpanded && (
                      <div className="px-4 py-4 border-t border-gray-200">
                        {/* Values header */}
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-700">Values</h3>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openAddValueModal(option.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            >
                              Add Value
                            </button>
                          )}
                        </div>

                        {/* Loading values */}
                        {loadingVals && (
                          <div className="space-y-2">
                            {Array.from({ length: 2 }).map((_, i) => (
                              <Skeleton key={i} className="h-9 w-full rounded" />
                            ))}
                          </div>
                        )}

                        {/* No values */}
                        {!loadingVals && values.length === 0 && (
                          <p className="text-xs text-gray-400 py-2">
                            No values yet. Add the first value for this option.
                          </p>
                        )}

                        {/* Values table */}
                        {!loadingVals && values.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100">
                                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Value</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Code</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Color Code</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Order</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Active</th>
                                  {canManage && (
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-600">Actions</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {values.map((val) => (
                                  <tr key={val.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="px-3 py-2 text-gray-900">{val.value}</td>
                                    <td className="px-3 py-2 text-gray-600">{val.code ?? '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {val.colorCode ? (
                                        <span className="flex items-center gap-1.5">
                                          <span
                                            className="inline-block w-4 h-4 rounded border border-gray-200"
                                            style={{ backgroundColor: val.colorCode }}
                                          />
                                          {val.colorCode}
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{val.displayOrder}</td>
                                    <td className="px-3 py-2">
                                      {val.isActive ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Yes</span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">No</span>
                                      )}
                                    </td>
                                    {canManage && (
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => openEditValueModal(option.id, val)}
                                            className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openDeleteValueDialog(option.id, val)}
                                            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                                          >
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
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Add Option Modal                                                     */}
      {/* ------------------------------------------------------------------- */}
      <Modal isOpen={isAddOptionModalOpen} onClose={closeAddOptionModal} title="Add Option">
        <form onSubmit={handleAddOption} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="add-option-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="add-option-name"
              type="text"
              value={optionForm.name}
              onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          {/* Type */}
          <div>
            <label htmlFor="add-option-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="add-option-type"
              value={optionForm.type}
              onChange={(e) => setOptionForm({ ...optionForm, type: e.target.value as 'TEXT' | 'COLOR' | 'NUMBER' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="TEXT">TEXT</option>
              <option value="COLOR">COLOR</option>
              <option value="NUMBER">NUMBER</option>
            </select>
          </div>
          {/* Display Order */}
          <div>
            <label htmlFor="add-option-display-order" className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              id="add-option-display-order"
              type="number"
              min="0"
              value={optionForm.displayOrder}
              onChange={(e) => setOptionForm({ ...optionForm, displayOrder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={optionForm.isRequired}
                onChange={(e) => setOptionForm({ ...optionForm, isRequired: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={optionForm.isVariant}
                onChange={(e) => setOptionForm({ ...optionForm, isVariant: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Variant
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeAddOptionModal}
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
              {submitting ? 'Adding...' : 'Add Option'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* Edit Option Modal                                                    */}
      {/* ------------------------------------------------------------------- */}
      <Modal isOpen={isEditOptionModalOpen} onClose={closeEditOptionModal} title="Edit Option">
        <form onSubmit={handleEditOption} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="edit-option-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-option-name"
              type="text"
              value={optionForm.name}
              onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          {/* Type */}
          <div>
            <label htmlFor="edit-option-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="edit-option-type"
              value={optionForm.type}
              onChange={(e) => setOptionForm({ ...optionForm, type: e.target.value as 'TEXT' | 'COLOR' | 'NUMBER' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="TEXT">TEXT</option>
              <option value="COLOR">COLOR</option>
              <option value="NUMBER">NUMBER</option>
            </select>
          </div>
          {/* Display Order */}
          <div>
            <label htmlFor="edit-option-display-order" className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              id="edit-option-display-order"
              type="number"
              min="0"
              value={optionForm.displayOrder}
              onChange={(e) => setOptionForm({ ...optionForm, displayOrder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={optionForm.isRequired}
                onChange={(e) => setOptionForm({ ...optionForm, isRequired: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={optionForm.isVariant}
                onChange={(e) => setOptionForm({ ...optionForm, isVariant: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Variant
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditOptionModal}
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

      {/* ------------------------------------------------------------------- */}
      {/* Delete Option ConfirmDialog                                          */}
      {/* ------------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={isDeleteOptionDialogOpen}
        title="Delete Option"
        description={`Are you sure you want to delete the option "${deletingOption?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteOption}
        onCancel={closeDeleteOptionDialog}
      />

      {/* ------------------------------------------------------------------- */}
      {/* Add Value Modal                                                      */}
      {/* ------------------------------------------------------------------- */}
      <Modal isOpen={isAddValueModalOpen} onClose={closeAddValueModal} title="Add Value">
        <form onSubmit={handleAddValue} className="space-y-4">
          {/* Value */}
          <div>
            <label htmlFor="add-val-value" className="block text-sm font-medium text-gray-700 mb-1">
              Value <span className="text-red-500">*</span>
            </label>
            <input
              id="add-val-value"
              type="text"
              value={valueForm.value}
              onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          {/* Code */}
          <div>
            <label htmlFor="add-val-code" className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <input
              id="add-val-code"
              type="text"
              value={valueForm.code}
              onChange={(e) => setValueForm({ ...valueForm, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {/* Color Code */}
          <div>
            <label htmlFor="add-val-color-code" className="block text-sm font-medium text-gray-700 mb-1">
              Color Code
            </label>
            <input
              id="add-val-color-code"
              type="text"
              placeholder="#ffffff"
              value={valueForm.colorCode}
              onChange={(e) => setValueForm({ ...valueForm, colorCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {/* Display Order */}
          <div>
            <label htmlFor="add-val-display-order" className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              id="add-val-display-order"
              type="number"
              min="0"
              value={valueForm.displayOrder}
              onChange={(e) => setValueForm({ ...valueForm, displayOrder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeAddValueModal}
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
              {submitting ? 'Adding...' : 'Add Value'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* Edit Value Modal                                                     */}
      {/* ------------------------------------------------------------------- */}
      <Modal isOpen={isEditValueModalOpen} onClose={closeEditValueModal} title="Edit Value">
        <form onSubmit={handleEditValue} className="space-y-4">
          {/* Value */}
          <div>
            <label htmlFor="edit-val-value" className="block text-sm font-medium text-gray-700 mb-1">
              Value <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-val-value"
              type="text"
              value={valueForm.value}
              onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          {/* Code */}
          <div>
            <label htmlFor="edit-val-code" className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <input
              id="edit-val-code"
              type="text"
              value={valueForm.code}
              onChange={(e) => setValueForm({ ...valueForm, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {/* Color Code */}
          <div>
            <label htmlFor="edit-val-color-code" className="block text-sm font-medium text-gray-700 mb-1">
              Color Code
            </label>
            <input
              id="edit-val-color-code"
              type="text"
              placeholder="#ffffff"
              value={valueForm.colorCode}
              onChange={(e) => setValueForm({ ...valueForm, colorCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {/* Display Order */}
          <div>
            <label htmlFor="edit-val-display-order" className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              id="edit-val-display-order"
              type="number"
              min="0"
              value={valueForm.displayOrder}
              onChange={(e) => setValueForm({ ...valueForm, displayOrder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditValueModal}
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

      {/* ------------------------------------------------------------------- */}
      {/* Delete Value ConfirmDialog                                           */}
      {/* ------------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={isDeleteValueDialogOpen}
        title="Delete Value"
        description={`Are you sure you want to delete the value "${deletingValue?.value}"? This action cannot be undone.`}
        onConfirm={handleDeleteValue}
        onCancel={closeDeleteValueDialog}
      />
    </div>
  );
}
