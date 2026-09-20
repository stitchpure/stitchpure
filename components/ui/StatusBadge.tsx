type StatusBadgeProps = {
  status: string;
};

const STATUS_CLASSES: Record<string, string> = {
  // Green — positive / completed states
  ACTIVE: 'bg-green-100 text-green-800',
  RECEIVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',

  // Yellow — in-progress / awaiting states
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',

  // Gray — draft / neutral states
  DRAFT: 'bg-gray-100 text-gray-800',

  // Red — negative / stopped states
  INACTIVE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DISCONTINUED: 'bg-red-100 text-red-800',
};

const DEFAULT_CLASSES = 'bg-gray-100 text-gray-800';

/**
 * Displays a color-coded inline badge for a record's status string.
 *
 * Supported statuses and their colors:
 *   Green  — ACTIVE, RECEIVED, COMPLETED
 *   Yellow — PENDING
 *   Red    — INACTIVE, CANCELLED, DISCONTINUED
 *   Gray   — any unrecognized status (fallback)
 */
export default function StatusBadge({ status }: StatusBadgeProps) {
  const colorClasses = STATUS_CLASSES[status.toUpperCase()] ?? DEFAULT_CLASSES;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}
    >
      {status}
    </span>
  );
}
