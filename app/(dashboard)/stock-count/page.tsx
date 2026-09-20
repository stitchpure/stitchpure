'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/ToastContext';
import { apiClient } from '@/lib/api-client';
import dynamic from 'next/dynamic';
import type { ScannedProductItem } from '@/components/barcode-scanner';

const BarcodeScanner = dynamic(() => import('@/components/barcode-scanner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
      Loading scanner…
    </div>
  ),
});

// ── Types ────────────────────────────────────────────────────────────────────

interface StockCountEntry {
  sku: string;
  productName: string;
  counted: number;
  systemStock: number;
}

type PageState = 'idle' | 'counting' | 'complete';

// ── Component ────────────────────────────────────────────────────────────────

export default function StockCountPage() {
  const { showToast } = useToast();

  const [pageState, setPageState] = useState<PageState>('idle');
  const [counts, setCounts] = useState<Map<string, StockCountEntry>>(new Map());
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  // ── Start counting session ───────────────────────────────────────────────

  function handleStartCounting() {
    setCounts(new Map());
    setStartedAt(new Date());
    setPageState('counting');
  }

  // ── Handle successful scan ───────────────────────────────────────────────

  const handleScanSuccess = useCallback((productItem: ScannedProductItem) => {
    setCounts((prev) => {
      const next = new Map(prev);
      const existing = next.get(productItem.sku);

      if (existing) {
        next.set(productItem.sku, {
          ...existing,
          counted: existing.counted + 1,
        });
      } else {
        next.set(productItem.sku, {
          sku: productItem.sku,
          productName: productItem.productName,
          counted: 1,
          systemStock: productItem.currentStock,
        });
      }

      return next;
    });

    showToast(`Scanned: ${productItem.sku}`, 'success');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle scan error ────────────────────────────────────────────────────

  const handleScanError = useCallback((error: string) => {
    showToast(error, 'error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hardware barcode scanner support (keyboard input) ────────────────────
  // USB/Bluetooth barcode scanners act like keyboards: they type the barcode
  // text rapidly and press Enter. We detect this pattern.

  const keyBufferRef = useRef('');
  const keyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pageState !== 'counting') return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is focused on an input element
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Enter' && keyBufferRef.current.length >= 3) {
        // Treat buffered text as a scanned SKU
        const scannedSku = keyBufferRef.current.trim();
        keyBufferRef.current = '';

        // Look up the SKU via API
        (async () => {
          const result = await apiClient.get<{
            id: string;
            sku: string;
            productName: string;
            stockLevel: number;
            optionValues: { value: string }[];
          }>(`/api/product-items/sku/${encodeURIComponent(scannedSku)}`);

          if (result.success && 'data' in result) {
            const data = result.data;
            const variantInfo = data.optionValues?.map((ov) => ov.value).join(' / ') ?? '';
            handleScanSuccess({
              id: data.id,
              sku: data.sku,
              productName: data.productName ?? '',
              variantInfo,
              currentStock: data.stockLevel ?? 0,
            });
          } else {
            showToast(`SKU "${scannedSku}" not found`, 'error');
          }
        })();
      } else if (e.key.length === 1) {
        // Accumulate characters (barcode scanners type fast)
        keyBufferRef.current += e.key;

        // Reset buffer if no input for 100ms (manual typing is slower)
        if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
        keyTimerRef.current = setTimeout(() => {
          keyBufferRef.current = '';
        }, 100);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState]);

  // ── Complete session ─────────────────────────────────────────────────────

  function handleComplete() {
    setPageState('complete');
  }

  // ── Reset session ────────────────────────────────────────────────────────

  function handleNewSession() {
    setCounts(new Map());
    setStartedAt(null);
    setPageState('idle');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const countsArray = Array.from(counts.values());
  const totalScanned = countsArray.reduce((sum, entry) => sum + entry.counted, 0);
  const discrepancies = countsArray.filter((entry) => entry.counted !== entry.systemStock);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Stock Count</h1>
            {startedAt && pageState !== 'idle' && (
              <p className="text-sm text-gray-500 mt-0.5">
                Started {startedAt.toLocaleTimeString()}
              </p>
            )}
          </div>

          {pageState === 'idle' && (
            <button
              type="button"
              onClick={handleStartCounting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Start Counting
            </button>
          )}

          {pageState === 'counting' && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={countsArray.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Complete
            </button>
          )}

          {pageState === 'complete' && (
            <button
              type="button"
              onClick={handleNewSession}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              New Session
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Idle state */}
          {pageState === 'idle' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Ready to Count Stock</h2>
              <p className="text-sm text-gray-500 max-w-md">
                Start a counting session to scan barcodes and verify your physical stock against the system records.
              </p>
            </div>
          )}

          {/* Counting state */}
          {pageState === 'counting' && (
            <div className="space-y-6">
              {/* Scanner */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h2 className="text-sm font-medium text-gray-700 mb-3">Barcode Scanner</h2>
                <BarcodeScanner
                  onScanSuccess={handleScanSuccess}
                  onScanError={handleScanError}
                  autoStart
                  className="max-w-md mx-auto"
                />
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-600">
                  <span className="font-medium text-gray-900">{countsArray.length}</span> unique SKUs
                </span>
                <span className="text-gray-600">
                  <span className="font-medium text-gray-900">{totalScanned}</span> total scans
                </span>
              </div>

              {/* Running count table */}
              {countsArray.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">SKU</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Product Name</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Counted Qty</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">System Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {countsArray.map((entry) => (
                        <tr key={entry.sku} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-900">{entry.sku}</td>
                          <td className="px-4 py-3 text-gray-700">{entry.productName}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{entry.counted}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{entry.systemStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {countsArray.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  Scan barcodes to start counting. Each scan increments the count for that SKU.
                </div>
              )}
            </div>
          )}

          {/* Complete state — comparison view */}
          {pageState === 'complete' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-600">
                  <span className="font-medium text-gray-900">{countsArray.length}</span> SKUs counted
                </span>
                <span className="text-gray-600">
                  <span className="font-medium text-gray-900">{totalScanned}</span> total items scanned
                </span>
                {discrepancies.length > 0 ? (
                  <span className="text-red-600 font-medium">
                    {discrepancies.length} discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} found
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">
                    All counts match system stock
                  </span>
                )}
              </div>

              {/* Comparison table */}
              {countsArray.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">SKU</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Product Name</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Counted Qty</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">System Stock</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Difference</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {countsArray.map((entry) => {
                        const diff = entry.counted - entry.systemStock;
                        const isMatch = diff === 0;

                        return (
                          <tr
                            key={entry.sku}
                            className={isMatch ? 'bg-green-50' : 'bg-red-50'}
                          >
                            <td className="px-4 py-3 font-mono text-gray-900">{entry.sku}</td>
                            <td className="px-4 py-3 text-gray-700">{entry.productName}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{entry.counted}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{entry.systemStock}</td>
                            <td className={`px-4 py-3 text-right font-medium ${isMatch ? 'text-green-700' : 'text-red-700'}`}>
                              {diff > 0 ? `+${diff}` : diff === 0 ? '0' : String(diff)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isMatch ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Match
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Mismatch
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {countsArray.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  No items were scanned during this session.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
