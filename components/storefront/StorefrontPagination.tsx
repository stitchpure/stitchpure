"use client";

import { formatPageRange } from "@/lib/storefront-utils";

interface StorefrontPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  noun?: string;
}

export default function StorefrontPagination({
  page,
  totalPages,
  total,
  limit,
  onChange,
  noun = "products",
}: StorefrontPaginationProps) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="text-center text-sm text-[var(--sf-muted)]">
        {formatPageRange(page, limit, total, noun)}
      </p>
    ) : null;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  const withEllipsis: (number | "…")[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) {
      withEllipsis.push("…");
    }
    withEllipsis.push(pages[i]);
  }

  const btnBase =
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <p className="text-sm text-[var(--sf-muted)]">
        {formatPageRange(page, limit, total, noun)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={`${btnBase} border border-[var(--sf-line)] bg-white text-[var(--sf-ink)] hover:bg-[var(--sf-accent-soft)]`}
        >
          Previous
        </button>
        {withEllipsis.map((item, idx) =>
          item === "…" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-[var(--sf-soft)]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`${btnBase} min-w-9 ${
                item === page
                  ? "bg-[var(--sf-accent)] text-white"
                  : "border border-[var(--sf-line)] bg-white text-[var(--sf-ink)] hover:bg-[var(--sf-accent-soft)]"
              }`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={`${btnBase} border border-[var(--sf-line)] bg-white text-[var(--sf-ink)] hover:bg-[var(--sf-accent-soft)]`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
