'use client';

import { useState, useCallback } from 'react';
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
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaleItem {
  id: string;
  productItemId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

type ReturnCondition = 'Good' | 'Damaged' | 'Wrong_Product';
type ReturnReason = 'Size_Issue' | 'Damaged_In_Transit' | 'Changed_Mind' | 'Wrong_Product_Shipped';

type Step = 'scanning' | 'mismatch' | 'condition' | 'reason' | 'submitting' | 'success';

export interface ReturnProcessingProps {
  saleId: string;
  saleItems: SaleItem[];
  onClose: () => void;
  onReturnProcessed: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReturnProcessing({
  saleId,
  saleItems,
  onClose,
  onReturnProcessed,
}: ReturnProcessingProps) {
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('scanning');
  const [scannedProduct, setScannedProduct] = useState<ScannedProductItem | null>(null);
  const [condition, setCondition] = useState<ReturnCondition | null>(null);
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Barcode scan handlers
  // -------------------------------------------------------------------------

  const handleScanSuccess = useCallback((productItem: ScannedProductItem) => {
    // Compare scanned product item ID against sale items
    const match = saleItems.some(
      (item) => item.productItemId === productItem.id
    );

    setScannedProduct(productItem);

    if (match) {
      // Match found — proceed to condition selection
      setStep('condition');
    } else {
      // Mismatch — show error options
      setStep('mismatch');
    }
  }, [saleItems]);

  const handleScanError = useCallback(() => {
    // Errors are handled by the BarcodeScanner component's built-in UI
  }, []);

  // -------------------------------------------------------------------------
  // Mismatch handlers
  // -------------------------------------------------------------------------

  const handleRescan = useCallback(() => {
    setScannedProduct(null);
    setStep('scanning');
  }, []);

  const handleWrongProduct = useCallback(() => {
    // Proceed with "Wrong_Product" condition pre-selected
    setCondition('Wrong_Product');
    setStep('reason');
  }, []);

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------

  async function handleSubmit() {
    if (!condition || !reason) return;

    setSubmitting(true);
    setStep('submitting');

    const result = await apiClient.post<unknown>(`/api/returns/${saleId}`, {
      returnCondition: condition,
      returnReason: reason,
      scannedSku: scannedProduct?.sku,
    });

    setSubmitting(false);

    if (result.success) {
      setStep('success');
      showToast('Return processed successfully', 'success');
      onReturnProcessed();
    } else {
      showToast('message' in result ? result.message : 'Failed to process return', 'error');
      // Go back to condition step so user can retry
      setStep('condition');
    }
  }

  // -------------------------------------------------------------------------
  // Step indicator
  // -------------------------------------------------------------------------

  const steps = ['Scan', 'Condition', 'Reason', 'Submit'];
  const currentStepIndex =
    step === 'scanning' || step === 'mismatch' ? 0 :
    step === 'condition' ? 1 :
    step === 'reason' ? 2 : 3;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Process Return</h2>
          <p className="text-sm text-gray-500 mt-0.5">Scan item barcode to verify and process return</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Close return processing"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Step indicator */}
      <div className="px-6 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {steps.map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                  idx < currentStepIndex
                    ? 'bg-green-100 text-green-700'
                    : idx === currentStepIndex
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {idx < currentStepIndex ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  idx <= currentStepIndex ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
              {idx < steps.length - 1 && (
                <div className={`w-8 h-px ${idx < currentStepIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Step: Scanning */}
        {step === 'scanning' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Scan the barcode on the returned item to verify it matches this sale.
            </p>
            <BarcodeScanner
              onScanSuccess={handleScanSuccess}
              onScanError={handleScanError}
              autoStart
              className="max-w-md mx-auto"
            />
          </div>
        )}

        {/* Step: Mismatch */}
        {step === 'mismatch' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">Product Mismatch</p>
                  <p className="text-sm text-red-700 mt-1">
                    The scanned item <span className="font-mono font-medium">{scannedProduct?.sku}</span> ({scannedProduct?.productName}) does not match any item in this sale.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRescan}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Re-scan
              </button>
              <button
                type="button"
                onClick={handleWrongProduct}
                className="px-4 py-2 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Wrong Product
              </button>
            </div>
          </div>
        )}

        {/* Step: Condition selection */}
        {step === 'condition' && (
          <div className="space-y-4">
            {scannedProduct && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-800 font-medium">
                    Verified: {scannedProduct.productName} ({scannedProduct.sku})
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What is the condition of the returned item?
              </label>
              <div className="space-y-2">
                {([
                  { value: 'Good', label: 'Good', description: 'Item is in original condition and can be restocked' },
                  { value: 'Damaged', label: 'Damaged', description: 'Item has damage and cannot be sold as new' },
                  { value: 'Wrong_Product', label: 'Wrong Product', description: 'A different product was received' },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      condition === opt.value
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={opt.value}
                      checked={condition === opt.value}
                      onChange={() => setCondition(opt.value)}
                      className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (condition) setStep('reason');
                }}
                disabled={!condition}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={handleRescan}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Scan
              </button>
            </div>
          </div>
        )}

        {/* Step: Reason selection */}
        {step === 'reason' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="return-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Why is this item being returned?
              </label>
              <select
                id="return-reason"
                value={reason ?? ''}
                onChange={(e) => setReason(e.target.value as ReturnReason)}
                className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="" disabled>Select a reason...</option>
                <option value="Size_Issue">Size Issue</option>
                <option value="Damaged_In_Transit">Damaged in Transit</option>
                <option value="Changed_Mind">Changed Mind</option>
                <option value="Wrong_Product_Shipped">Wrong Product Shipped</option>
              </select>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-md">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Return Summary</h4>
              <dl className="space-y-1.5 text-sm">
                {scannedProduct && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Product</dt>
                    <dd className="font-medium text-gray-900">{scannedProduct.productName}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Condition</dt>
                  <dd className="font-medium text-gray-900">{condition?.replace('_', ' ')}</dd>
                </div>
                {reason && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Reason</dt>
                    <dd className="font-medium text-gray-900">{reason.replace(/_/g, ' ')}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processing...' : 'Submit Return'}
              </button>
              <button
                type="button"
                onClick={() => setStep('condition')}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-600">Processing return...</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-800 mb-1">Return Processed Successfully</p>
            <p className="text-xs text-gray-500 mb-4">The sale record has been updated with return information.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
