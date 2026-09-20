'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';
import Skeleton from '@/components/ui/Skeleton';
import {
  generateBatchLabelsHtml,
  generateLabelHtml,
  triggerPrint,
  type LabelData,
} from '@/lib/barcode';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductItem {
  id: string;
  sku: string;
  productId: string;
  productName?: string;
  variantInfo?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BarcodeLabelsPage() {
  const { showToast } = useToast();

  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchQuantity, setBatchQuantity] = useState<number>(1);

  // ── Fetch product items on mount ─────────────────────────────────────────

  useEffect(() => {
    async function fetchProductItems() {
      setLoading(true);
      const result = await apiClient.get<ProductItem[]>('/api/product-items?limit=100');
      if (result.success && 'data' in result) {
        setProductItems(result.data);
      } else {
        showToast(result.message, 'error');
      }
      setLoading(false);
    }

    fetchProductItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Selection handlers ───────────────────────────────────────────────────

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === productItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(productItems.map((item) => item.id)));
    }
  }

  // ── Build label data from selected items ─────────────────────────────────

  const labelDataItems: LabelData[] = useMemo(() => {
    const selected = productItems.filter((item) => selectedIds.has(item.id));
    const items: LabelData[] = [];

    for (const item of selected) {
      const labelData: LabelData = {
        sku: item.sku,
        productName: item.productName ?? '',
        variantInfo: item.variantInfo ?? '',
      };

      // Duplicate for batch quantity
      for (let i = 0; i < batchQuantity; i++) {
        items.push(labelData);
      }
    }

    return items;
  }, [productItems, selectedIds, batchQuantity]);

  // ── Print handler ────────────────────────────────────────────────────────

  function handlePrint() {
    if (labelDataItems.length === 0) {
      showToast('Select at least one product item to print labels', 'error');
      return;
    }

    try {
      const html = generateBatchLabelsHtml(labelDataItems);
      triggerPrint(html);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to open print dialog',
        'error'
      );
    }
  }

  // ── Preview labels HTML ──────────────────────────────────────────────────

  const previewHtml = useMemo(() => {
    if (labelDataItems.length === 0) return '';
    // Show up to 10 labels in preview to keep it performant
    const previewItems = labelDataItems.slice(0, 10);
    return previewItems.map((item) => generateLabelHtml(item)).join('');
  }, [labelDataItems]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Barcode Labels</h1>
          <button
            type="button"
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Print Labels
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Product Item Selector + Batch Quantity */}
          <div className="space-y-4">
            {/* Batch Quantity Input */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="batch-quantity"
                className="text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                Labels per item:
              </label>
              <input
                id="batch-quantity"
                type="number"
                min={1}
                max={100}
                value={batchQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 100) {
                    setBatchQuantity(val);
                  }
                }}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-500">
                {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
                {selectedIds.size > 0 && ` · ${labelDataItems.length} label${labelDataItems.length !== 1 ? 's' : ''} total`}
              </span>
            </div>

            {/* Select All */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <input
                id="select-all"
                type="checkbox"
                checked={productItems.length > 0 && selectedIds.size === productItems.length}
                onChange={selectAll}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="select-all" className="text-sm font-medium text-gray-700">
                Select All
              </label>
            </div>

            {/* Product Items List */}
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {loading && (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-10 w-full rounded" />
                  ))}
                </div>
              )}

              {!loading && productItems.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No product items found.
                </p>
              )}

              {!loading &&
                productItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.productName ?? 'Unnamed Product'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        SKU: {item.sku}
                        {item.variantInfo && ` · ${item.variantInfo}`}
                      </p>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          {/* Right: Label Preview Panel */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700">
              Preview
              {labelDataItems.length > 10 && (
                <span className="text-xs text-gray-400 ml-2">
                  (showing first 10 of {labelDataItems.length})
                </span>
              )}
            </h2>

            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[200px] overflow-auto max-h-[480px]">
              {selectedIds.size === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[180px]">
                  <p className="text-sm text-gray-400">
                    Select product items to preview labels
                  </p>
                </div>
              ) : (
                <div
                  className="flex flex-wrap gap-2 justify-center"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
