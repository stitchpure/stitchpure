'use client';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** The name or identifier of the record being acted upon (Req 17.3). */
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for destructive actions (delete / deactivate / discontinue / cancel).
 *
 * - Renders nothing when `isOpen` is false (Req 17.1)
 * - Displays the record name/identifier via `description` (Req 17.3)
 * - "Cancel" (gray) dismisses without any action (Req 17.2)
 * - "Confirm" (red/destructive) proceeds with the action
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    /* Full-screen fixed overlay with semi-transparent dark backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      {/* Centered white card */}
      <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl p-6">
        {/* Title */}
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-gray-900 mb-2"
        >
          {title}
        </h2>

        {/* Description — shows the record name/identifier (Req 17.3) */}
        <p
          id="confirm-dialog-description"
          className="text-sm text-gray-600 mb-6"
        >
          {description}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {/* Cancel — gray, no action (Req 17.2) */}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Cancel
          </button>

          {/* Confirm — red/destructive */}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
