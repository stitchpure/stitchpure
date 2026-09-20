"use client";

import type { StorefrontCategory } from "@/types/storefront";

interface CategoryFilterProps {
  categories: StorefrontCategory[];
  selected: string | null;
  onChange: (categoryId: string | null) => void;
}

export default function CategoryFilter({
  categories,
  selected,
  onChange,
}: CategoryFilterProps) {
  return (
    <label className="relative block w-full sm:w-56">
      <span className="sr-only">Filter by category</span>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full appearance-none rounded-xl border border-transparent bg-[#f3f7f5] px-4 py-3 pr-10 text-sm text-[var(--sf-ink)] transition-all duration-200 focus:border-[var(--sf-accent)]/25 focus:bg-white focus:outline-none focus:ring-3 focus:ring-[var(--sf-accent)]/10"
      >
        <option value="">All Categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-[var(--sf-soft)]"
      >
        <path
          fillRule="evenodd"
          d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </label>
  );
}
