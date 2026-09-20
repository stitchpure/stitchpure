'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Html5Module = typeof import('html5-qrcode');
type Html5QrcodeInstance = InstanceType<Html5Module['Html5Qrcode']>;

export interface ScannedProductItem {
  id: string;
  sku: string;
  productName: string;
  variantInfo: string;
  currentStock: number;
}

export interface BarcodeScannerProps {
  /** Called when a barcode is successfully scanned and product item is found */
  onScanSuccess: (productItem: ScannedProductItem) => void;
  /** Called when an error occurs during scanning */
  onScanError: (error: string) => void;
  /** Auto-start scanning on mount (default: false) */
  autoStart?: boolean;
  /** Custom class name for the container */
  className?: string;
}

type ScannerState =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'success'
  | 'error';

type ErrorType =
  | 'camera_denied'
  | 'sku_not_found'
  | 'no_barcode'
  | 'camera_unavailable'
  | 'unknown';

interface ScanError {
  type: ErrorType;
  message: string;
}

// ---------------------------------------------------------------------------
// Audio feedback utility
// ---------------------------------------------------------------------------

function playBeep(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch {
    // Audio not available — fail silently
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SCANNER_ELEMENT_ID = 'barcode-scanner-reader';
const NO_BARCODE_TIMEOUT_MS = 10_000;

export default function BarcodeScanner({
  onScanSuccess,
  onScanError,
  autoStart = false,
  className = '',
}: BarcodeScannerProps) {
  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<ScanError | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [lookingUpSku, setLookingUpSku] = useState(false);

  const html5Ref = useRef<Html5Module | null>(null);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track mount state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // SKU Lookup
  // -------------------------------------------------------------------------

  const lookupSku = useCallback(async (sku: string) => {
    setLookingUpSku(true);

    const result = await apiClient.get<{
      id: string;
      sku: string;
      productName: string;
      stockLevel: number;
      optionValues: { value: string }[];
    }>(`/api/product-items/sku/${encodeURIComponent(sku)}`);

    if (!isMountedRef.current) return;
    setLookingUpSku(false);

    if (!result.success) {
      const errorMsg = `SKU "${sku}" not found`;
      setError({ type: 'sku_not_found', message: errorMsg });
      setState('error');
      onScanError(errorMsg);
      return;
    }

    // Success — visual + audio feedback
    setShowFlash(true);
    playBeep();
    setState('success');

    setTimeout(() => {
      if (isMountedRef.current) setShowFlash(false);
    }, 600);

    const data = result.data;
    const variantInfo = data.optionValues?.map((ov) => ov.value).join(' / ') ?? '';
    onScanSuccess({
      id: data.id,
      sku: data.sku,
      productName: data.productName ?? '',
      variantInfo,
      currentStock: data.stockLevel ?? 0,
    });
  }, [onScanSuccess, onScanError]);

  // -------------------------------------------------------------------------
  // Start / Stop scanning
  // -------------------------------------------------------------------------

  const stopScanner = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (scannerRef.current && html5Ref.current) {
      try {
        const { Html5QrcodeScannerState } = html5Ref.current;
        const scannerState = scannerRef.current.getState();
        if (scannerState === Html5QrcodeScannerState.SCANNING || scannerState === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null;
    }

    if (isMountedRef.current) {
      setState('idle');
      isProcessingRef.current = false;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setState('starting');
    setError(null);
    isProcessingRef.current = false;

    const html5 = html5Ref.current ?? (await import('html5-qrcode'));
    html5Ref.current = html5;
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = html5;

    // Check for camera availability
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setError({ type: 'camera_unavailable', message: 'No camera found on this device' });
        setState('error');
        onScanError('No camera found on this device');
        return;
      }
    } catch {
      setError({ type: 'camera_denied', message: 'Camera permission denied. Please enable camera access in your browser settings.' });
      setState('error');
      onScanError('Camera permission denied');
      return;
    }

    // Create scanner instance
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
        },
        // onScanSuccess callback
        async (decodedText) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          // Clear the no-barcode timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          // Pause scanning while looking up SKU
          try {
            await scanner.pause(true);
          } catch {
            // May fail if already stopped
          }

          await lookupSku(decodedText);
        },
        // onScanFailure — ignore individual frame failures
        () => {}
      );

      if (isMountedRef.current) {
        setState('scanning');

        // Set timeout for no barcode detected
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !isProcessingRef.current) {
            setError({ type: 'no_barcode', message: 'No barcode detected. Try repositioning the barcode in the camera view.' });
            setState('error');
            onScanError('No barcode detected');
          }
        }, NO_BARCODE_TIMEOUT_MS);
      }
    } catch {
      if (isMountedRef.current) {
        setError({ type: 'camera_denied', message: 'Camera permission denied. Please enable camera access in your browser settings.' });
        setState('error');
        onScanError('Camera permission denied');
      }
    }
  }, [lookupSku, onScanError]);

  // -------------------------------------------------------------------------
  // Auto-start & cleanup
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (autoStart) {
      startScanner();
    }

    return () => {
      // Cleanup on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (scannerRef.current && html5Ref.current) {
        try {
          const { Html5QrcodeScannerState } = html5Ref.current;
          const scannerState = scannerRef.current.getState();
          if (scannerState === Html5QrcodeScannerState.SCANNING || scannerState === Html5QrcodeScannerState.PAUSED) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Retry handler
  // -------------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    setError(null);
    isProcessingRef.current = false;
    startScanner();
  }, [startScanner]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={`relative rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Green flash overlay for success feedback */}
      {showFlash && (
        <div
          className="absolute inset-0 bg-green-400/40 z-10 pointer-events-none animate-pulse"
          aria-hidden="true"
        />
      )}

      {/* Scanner viewport */}
      <div
        id={SCANNER_ELEMENT_ID}
        className={`w-full min-h-[240px] bg-gray-900 ${state === 'idle' || state === 'error' ? 'hidden' : ''}`}
      />

      {/* Idle state */}
      {state === 'idle' && (
        <div className="flex flex-col items-center justify-center p-8 min-h-[240px] bg-gray-50">
          <svg
            className="w-12 h-12 text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4h4V3H2v5h1V4zm18-1h-5v1h4v4h1V3zM3 20v-4H2v5h5v-1H3zm18 0h-4v1h5v-5h-1v4zM7 7h3v3H7V7zm7 0h3v3h-3V7zm-7 7h3v3H7v-3zm7 0h3v3h-3v-3z"
            />
          </svg>
          <p className="text-sm text-gray-600 mb-4">Point your camera at a barcode to scan</p>
          <button
            onClick={startScanner}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Start Scanner
          </button>
        </div>
      )}

      {/* Starting state */}
      {state === 'starting' && (
        <div className="flex flex-col items-center justify-center p-8 min-h-[240px] bg-gray-50">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-600">Activating camera...</p>
        </div>
      )}

      {/* Scanning state — show stop button */}
      {state === 'scanning' && (
        <div className="p-3 bg-gray-800 flex items-center justify-between">
          <span className="text-xs text-green-400 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Scanning for barcodes...
          </span>
          <button
            onClick={stopScanner}
            className="px-3 py-1 bg-gray-700 text-gray-200 text-xs rounded hover:bg-gray-600 transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Looking up SKU */}
      {lookingUpSku && (
        <div className="p-3 bg-blue-50 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-700">Looking up product...</span>
        </div>
      )}

      {/* Success state */}
      {state === 'success' && (
        <div className="p-4 bg-green-50 border-t border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-800">Product found!</span>
          </div>
          <button
            onClick={handleRetry}
            className="mt-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
          >
            Scan Another
          </button>
        </div>
      )}

      {/* Error states */}
      {state === 'error' && error && (
        <div className="flex flex-col items-center justify-center p-6 min-h-[240px] bg-gray-50">
          {error.type === 'camera_denied' && (
            <>
              <svg className="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p className="text-sm font-medium text-red-700 mb-1">Camera Access Denied</p>
              <p className="text-xs text-gray-600 text-center max-w-xs mb-4">{error.message}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </>
          )}

          {error.type === 'camera_unavailable' && (
            <>
              <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-700 mb-1">Camera Not Available</p>
              <p className="text-xs text-gray-600 text-center max-w-xs">{error.message}</p>
            </>
          )}

          {error.type === 'sku_not_found' && (
            <>
              <svg className="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm font-medium text-red-700 mb-1">SKU Not Found</p>
              <p className="text-xs text-gray-600 text-center max-w-xs mb-4">{error.message}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Scan Again
              </button>
            </>
          )}

          {error.type === 'no_barcode' && (
            <>
              <svg className="w-10 h-10 text-amber-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-amber-700 mb-1">No Barcode Detected</p>
              <p className="text-xs text-gray-600 text-center max-w-xs mb-4">{error.message}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </>
          )}

          {error.type === 'unknown' && (
            <>
              <svg className="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm font-medium text-red-700 mb-1">Scanner Error</p>
              <p className="text-xs text-gray-600 text-center max-w-xs mb-4">{error.message}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
