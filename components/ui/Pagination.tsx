'use client';

interface PaginationProps {
  /** Current active page (1-indexed). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called with the new page number when the user navigates. */
  onPageChange: (page: number) => void;
}

/**
 * Page navigation control with Previous / numbered pages / Next.
 *
 * - Previous is disabled on page 1              (Req 6.8, 7.8, 9.10, 10.10, 12.5, 13.8)
 * - Next is disabled on the last page
 * - Shows an ellipsis window for large page counts so the bar stays compact
 * - Returns null when there is only one page (nothing to paginate)
 */
export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build the visible page-number list with at most 7 slots:
  //   1 … [page-1] [page] [page+1] … totalPages
  const pages = buildPageList(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1 mt-4"
    >
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Go to previous page"
        className="
          px-3 py-1.5 text-sm font-medium rounded-lg
          text-gray-700 bg-white border border-gray-300
          hover:bg-gray-50 transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
        "
      >
        Previous
      </button>

      {/* Page numbers / ellipsis */}
      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            aria-hidden="true"
            className="px-2 py-1.5 text-sm text-gray-400 select-none"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p as number)}
            aria-label={`Go to page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`
              min-w-[2rem] px-2 py-1.5 text-sm font-medium rounded-lg transition-colors
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
              ${
                p === page
                  ? 'bg-indigo-600 text-white border border-indigo-600'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Go to next page"
        className="
          px-3 py-1.5 text-sm font-medium rounded-lg
          text-gray-700 bg-white border border-gray-300
          hover:bg-gray-50 transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
        "
      >
        Next
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Helper — produce a compact list of page tokens (number | 'ellipsis')
// that always includes the first page, last page, the current page, and its
// immediate neighbours, with ellipsis placeholders to bridge any gaps.
// ---------------------------------------------------------------------------
type PageToken = number | 'ellipsis';

function buildPageList(current: number, total: number): PageToken[] {
  if (total <= 7) {
    // Show all pages — no ellipsis needed
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: PageToken[] = [];

  // Always include first page
  pages.push(1);

  const leftEdge = current - 1;
  const rightEdge = current + 1;

  // Left ellipsis: there is a gap between page 1 and the left neighbour
  if (leftEdge > 2) {
    pages.push('ellipsis');
  } else if (leftEdge === 2) {
    // No gap — just show page 2
    pages.push(2);
  }

  // Current window: prev, current, next (clamped to valid range, no duplicates)
  for (let p = Math.max(2, leftEdge); p <= Math.min(total - 1, rightEdge); p++) {
    pages.push(p);
  }

  // Right ellipsis: gap between right neighbour and last page
  if (rightEdge < total - 1) {
    pages.push('ellipsis');
  } else if (rightEdge === total - 1) {
    pages.push(total - 1);
  }

  // Always include last page
  pages.push(total);

  return pages;
}
