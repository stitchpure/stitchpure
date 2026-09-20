interface EmptyStateProps {
  message?: string;
  hint?: string;
}

export default function EmptyState({
  message = "No products are currently available.",
  hint = "Try adjusting or clearing your filters.",
}: EmptyStateProps) {
  return (
    <div className="rounded-[var(--sf-radius)] border border-dashed border-[var(--sf-line)] bg-white/50 px-6 py-20 text-center">
      <p className="sf-display text-lg font-medium text-[var(--sf-ink)]">
        {message}
      </p>
      <p className="mt-2 text-sm text-[var(--sf-muted)]">{hint}</p>
    </div>
  );
}
