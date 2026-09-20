'use client';

import { useCallback, useEffect, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaleItemInput {
  id: string;
  productItemId: string;
  quantity: number;
}

interface ExpectedItem {
  productItemId: string;
  sku: string;
  productName: string;
  variantInfo: string;
  quantity: number;
  verifiedCount: number;
}

interface PackingVerificationProps {
  saleId: string;
  saleItems: SaleItemInput[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PackingVerification({
  saleId,
  saleItems,
  onClose,
}: PackingVerificationProps) {
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);
  const [allVerified, setAllVerified] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch SKU info for each sale item
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function fetchItemDetails() {
      setLoading(true);
      setError(null);

      try {
        const items: ExpectedItem[] = [];

        for (const saleItem of saleItems) {
          // Fetch product item details to get SKU
          const result = await apiClient.get<{
            id: string;
            sku: string;
            product: { name: string };
            optionValues: Array<{ optionName: string; value: string }>;
          }>(`/api/product-items/${saleItem.productItemId}`);

          if (result.success) {
            const variantInfo = result.data.optionValues
              ?.map((ov) => `${ov.optionName}: ${ov.value}`)
              .join(', ') || '';

            items.push({
              productItemId: saleItem.productItemId,
              sku: result.data.sku,
              productName: result.data.product?.name || 'Unknown Product',
              variantInfo,
              quantity: saleItem.quantity,
              verifiedCount: 0,
            });
          } else {
            items.push({
              productItemId: saleItem.productItemId,
              sku: `ITEM-${saleItem.productItemId.slice(0, 8)}`,
              productName: 'Unknown Product',
              variantInfo: '',
              quantity: saleItem.quantity,
              verifiedCount: 0,
            });
          }
        }

        setExpectedItems(items);
      } catch {
        setError('Failed to load item details');
      } finally {
        setLoading(false);
      }
    }

    fetchItemDetails();
  }, [saleItems]);

  // ---------------------------------------------------------------------------
  // Check if all items are verified
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (expectedItems.length === 0) return;

    const allDone = expectedItems.every(
      (item) => item.verifiedCount >= item.quantity
    );

    if (allDone && !allVerified) {
      setAllVerified(true);
      setScannerActive(false);
    }
  }, [expectedItems, allVerified]);

  // ---------------------------------------------------------------------------
  // Scan handlers
  // ---------------------------------------------------------------------------

  const handleScanSuccess = useCallback(
    (productItem: ScannedProductItem) => {
      setMismatchWarning(null);

      // Find the expected item matching the scanned SKU
      const matchIndex = expectedItems.findIndex(
        (item) => item.sku === productItem.sku && item.verifiedCount < item.quantity
      );

      if (matchIndex === -1) {
        // Check if the item exists but is already fully verified
        const fullyVerified = expectedItems.find(
          (item) => item.sku === productItem.sku && item.verifiedCount >= item.quantity
        );

        if (fullyVerified) {
          setMismatchWarning(
            `SKU "${productItem.sku}" (${productItem.productName}) is already fully verified.`
          );
        } else {
          // Mismatch — SKU not in expected items
          setMismatchWarning(
            `Mismatch! SKU "${productItem.sku}" (${productItem.productName}) is not expected in this sale.`
          );
        }
        return;
      }

      // Mark as verified — increment verified count
      setExpectedItems((prev) =>
        prev.map((item, idx) =>
          idx === matchIndex
            ? { ...item, verifiedCount: item.verifiedCount + 1 }
            : item
        )
      );
    },
    [expectedItems]
  );

  const handleScanError = useCallback((errorMsg: string) => {
    // Scanner errors are handled by the BarcodeScanner component UI itself
    console.warn('Packing scan error:', errorMsg);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Loading packing verification...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Packing Verification</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close packing verification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Completion confirmation */}
      {allVerified && (
        <div className="px-6 py-4 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">All items verified!</p>
              <p className="text-xs text-green-700 mt-0.5">
                All {expectedItems.length} item(s) in this sale have been successfully verified for packing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mismatch warning */}
      {mismatchWarning && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-sm text-red-700 font-medium">{mismatchWarning}</p>
            <button
              type="button"
              onClick={() => setMismatchWarning(null)}
              className="ml-auto p-1 text-red-400 hover:text-red-600"
              aria-label="Dismiss warning"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Expected items list */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Expected Items</h4>
        <div className="space-y-2">
          {expectedItems.map((item) => {
            const isFullyVerified = item.verifiedCount >= item.quantity;
            const isPartiallyVerified = item.verifiedCount > 0 && !isFullyVerified;

            return (
              <div
                key={item.productItemId}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isFullyVerified
                    ? 'bg-green-50 border-green-200'
                    : isPartiallyVerified
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Verification icon */}
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      isFullyVerified
                        ? 'bg-green-500'
                        : isPartiallyVerified
                        ? 'bg-yellow-400'
                        : 'bg-gray-300'
                    }`}
                  >
                    {isFullyVerified ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold text-white">
                        {item.verifiedCount}
                      </span>
                    )}
                  </div>

                  {/* Item details */}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-gray-500">SKU: {item.sku}</span>
                      {item.variantInfo && (
                        <span className="text-xs text-gray-400">• {item.variantInfo}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quantity badge */}
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      isFullyVerified
                        ? 'bg-green-100 text-green-800'
                        : isPartiallyVerified
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.verifiedCount}/{item.quantity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barcode scanner */}
      {scannerActive && !allVerified && (
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Scan Items</h4>
          <BarcodeScanner
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
            autoStart
            className="max-w-md"
          />
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Sale: {saleId.slice(0, 8)}... • {expectedItems.filter((i) => i.verifiedCount >= i.quantity).length}/{expectedItems.length} items verified
        </p>
        <div className="flex items-center gap-2">
          {!allVerified && !scannerActive && (
            <button
              type="button"
              onClick={() => setScannerActive(true)}
              className="px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Resume Scanning
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {allVerified ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
