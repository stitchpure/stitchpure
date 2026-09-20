'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, type UserRole } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import Skeleton from '@/components/ui/Skeleton';
import type { ProductCostSheet, CostSheetStatus } from '@/types/product-cost-sheet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended interface with joined display fields from the API */
interface ProductCostSheetWithDetails extends ProductCostSheet {
  productName?: string;
  skuCode?: string | null;
  batchNumber?: string;
  productionBatchId: string;
}

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

export default function CostSheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { showToast } = useToast();

  // Auth
  const [role] = useState<UserRole | null>(() => getUser()?.role ?? null);
  const canManage = role === 'OWNER' || role === 'MANAGER';

  // Data
  const [costSheet, setCostSheet] = useState<ProductCostSheetWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition state
  const [transitioning, setTransitioning] = useState(false);
  const [activeTransition, setActiveTransition] = useState<CostSheetStatus | null>(null);

  // Archive confirmation dialog
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchCostSheet() {
    setLoading(true);
    setError(null);

    const result = await apiClient.get<ProductCostSheetWithDetails>(
      `/api/product-cost-sheets/${id}`
    );

    if (result.success) {
      setCostSheet(result.data);
    } else {
      setError(result.message);
    }

    setLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCostSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------------------------------------------------------------------
  // Status transition handler
  // ---------------------------------------------------------------------------

  async function handleTransition(newStatus: CostSheetStatus) {
    if (transitioning || !costSheet) return;
    setTransitioning(true);
    setActiveTransition(newStatus);

    const result = await apiClient.patch<ProductCostSheetWithDetails>(
      `/api/product-cost-sheets/${id}`,
      { status: newStatus }
    );

    if (result.success) {
      showToast(
        newStatus === 'ACTIVE'
          ? 'Cost sheet activated successfully'
          : 'Cost sheet archived successfully',
        'success'
      );
      fetchCostSheet();
    } else {
      showToast(result.message, 'error');
    }

    setTransitioning(false);
    setActiveTransition(null);
  }

  function handleArchiveConfirm() {
    setArchiveDialogOpen(false);
    handleTransition('ARCHIVED');
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
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
          onClick={() => router.push('/cost-sheets')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Cost Sheets
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchCostSheet}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!costSheet) return null;

  // ---------------------------------------------------------------------------
  // Render — detail
  // ---------------------------------------------------------------------------

  const isDraft = costSheet.status === 'DRAFT';
  const isActive = costSheet.status === 'ACTIVE';
  const isArchived = costSheet.status === 'ARCHIVED';

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.push('/cost-sheets')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Cost Sheets
      </button>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header with title, status badge, and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between px-6 py-4 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {costSheet.productName ?? 'Cost Sheet'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {costSheet.skuCode && (
                <span className="text-gray-400">SKU: {costSheet.skuCode}</span>
              )}
              {costSheet.skuCode && ' · '}
              Effective: {formatDate(costSheet.effectiveDate)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={costSheet.status} />

            {/* Action buttons — only for MANAGER/OWNER and non-ARCHIVED status */}
            {canManage && !isArchived && (
              <>
                {/* Activate button — visible for DRAFT status */}
                {isDraft && (
                  <button
                    type="button"
                    onClick={() => handleTransition('ACTIVE')}
                    disabled={transitioning}
                    aria-busy={activeTransition === 'ACTIVE'}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg
                      hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeTransition === 'ACTIVE' && <Spinner />}
                    Activate
                  </button>
                )}

                {/* Archive button — visible for ACTIVE status */}
                {isActive && (
                  <button
                    type="button"
                    onClick={() => setArchiveDialogOpen(true)}
                    disabled={transitioning}
                    aria-busy={activeTransition === 'ARCHIVED'}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg
                      hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeTransition === 'ARCHIVED' && <Spinner />}
                    Archive
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail fields */}
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Product</p>
            <p className="font-medium text-gray-900 mt-0.5">{costSheet.productName ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">SKU Code</p>
            <p className="font-medium text-gray-900 mt-0.5">{costSheet.skuCode ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Effective Date</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(costSheet.effectiveDate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p className="mt-0.5">
              <StatusBadge status={costSheet.status} />
            </p>
          </div>
          <div>
            <p className="text-gray-500">Linked Batch</p>
            <p className="font-medium mt-0.5">
              {costSheet.batchNumber ? (
                <Link
                  href={`/production-batches/${costSheet.productionBatchId}`}
                  className="text-indigo-600 hover:text-indigo-800 underline transition-colors"
                >
                  {costSheet.batchNumber}
                </Link>
              ) : (
                <Link
                  href={`/production-batches/${costSheet.productionBatchId}`}
                  className="text-indigo-600 hover:text-indigo-800 underline transition-colors"
                >
                  View Batch
                </Link>
              )}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(costSheet.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Last Updated</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(costSheet.updatedAt)}</p>
          </div>
        </div>

        {/* Per-unit Cost Breakdown */}
        <div className="px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Per-Unit Cost Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Cost Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Amount Per Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Material</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCostPerUnit(costSheet.materialCostPerUnit)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Labour</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCostPerUnit(costSheet.labourCostPerUnit)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Overhead</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCostPerUnit(costSheet.overheadCostPerUnit)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Packaging</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCostPerUnit(costSheet.packagingCostPerUnit)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Transport</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCostPerUnit(costSheet.transportCostPerUnit)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Other</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCostPerUnit(costSheet.otherCostPerUnit)}
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">Total Manufacturing Cost</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCostPerUnit(costSheet.totalManufacturingCostPerUnit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirm archive dialog */}
      <ConfirmDialog
        isOpen={archiveDialogOpen}
        title="Archive Cost Sheet"
        description={`Are you sure you want to archive this cost sheet${costSheet.productName ? ` for "${costSheet.productName}"` : ''}? This action cannot be undone.`}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveDialogOpen(false)}
      />
    </div>
  );
}
