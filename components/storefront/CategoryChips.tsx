"use client";

import Link from "next/link";

import type { StorefrontCategory } from "@/types/storefront";
import { trackEvent } from "@/lib/analytics";

interface CategoryChipsProps {
  categories: StorefrontCategory[];
  /** Currently active category id, or null for "All". */
  activeId: string | null;
}

/**
 * Horizontal, scrollable category filter chips shown above the catalog.
 * Selecting a chip navigates to /?category=<id> (shallow via Link), which the
 * server page uses to filter products. "All" clears the filter.
 */
export default function CategoryChips({
  categories,
  activeId,
}: CategoryChipsProps) {
  if (categories.length === 0) return null;

  const chip =
    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors";
  const active =
    "border-[var(--sp-ink)] bg-[var(--sp-ink)] text-[var(--sp-paper)]";
  const idle =
    "border-[var(--sf-line)] bg-white text-[var(--sp-ink)] hover:border-[var(--sp-ink)]";

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-2.5">
        <Link
          href="/#catalog"
          scroll={false}
          className={`${chip} ${activeId === null ? active : idle}`}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/?category=${cat.id}#catalog`}
            scroll={false}
            onClick={() =>
              trackEvent("select_category", {
                category_id: cat.id,
                category_name: cat.name,
              })
            }
            className={`${chip} ${activeId === cat.id ? active : idle}`}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
