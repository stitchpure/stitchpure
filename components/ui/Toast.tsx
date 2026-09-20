'use client';

import { useEffect } from 'react';

type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const TYPE_CLASSES: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
};

/**
 * Single toast notification component.
 *
 * - Fixed position at bottom-right
 * - Green background for success, red for error, white text
 * - Auto-dismisses after 4 seconds
 * - Manual close via × button
 */
export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 min-w-64 max-w-sm w-full px-4 py-3 rounded-md shadow-lg text-white text-sm
        ${TYPE_CLASSES[type]}
        animate-in slide-in-from-bottom-4 fade-in duration-300`}
    >
      <span className="flex-1 break-words">{message}</span>
      <button
        onClick={onClose}
        aria-label="Close notification"
        className="flex-shrink-0 ml-2 text-white/80 hover:text-white transition-colors text-base leading-none"
      >
        ×
      </button>
    </div>
  );
}
