"use client";

import { useState } from "react";
import type { StorefrontCategory } from "@/types/storefront";

interface ProductFilters {
  categoryIds: string[];
  minPrice: string;
  maxPrice: string;
}

interface ProductFilterSidebarProps extends ProductFilters {
  categories: StorefrontCategory[];
  onApply: (filters: ProductFilters) => void;
}

export default function ProductFilterSidebar({
  categories,
  categoryIds,
  minPrice,
  maxPrice,
  onApply,
}: ProductFilterSidebarProps) {
  const [draftCategories, setDraftCategories] = useState(categoryIds);
  const [draftMin, setDraftMin] = useState(minPrice);
  const [draftMax, setDraftMax] = useState(maxPrice);
  const [priceError, setPriceError] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setDraftCategories((current) =>
      current.includes(id)
        ? current.filter((categoryId) => categoryId !== id)
        : [...current, id]
    );
  }

  function applyFilters() {
    const min = draftMin === "" ? undefined : Number(draftMin);
    const max = draftMax === "" ? undefined : Number(draftMax);

    if (
      (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
      (max !== undefined && (!Number.isFinite(max) || max < 0))
    ) {
      setPriceError("Enter a valid price");
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError("Minimum price cannot exceed maximum price");
      return;
    }

    setPriceError(null);
    onApply({
      categoryIds: draftCategories,
      minPrice: draftMin,
      maxPrice: draftMax,
    });
  }

  function clearFilters() {
    setDraftCategories([]);
    setDraftMin("");
    setDraftMax("");
    setPriceError(null);
    onApply({ categoryIds: [], minPrice: "", maxPrice: "" });
  }

  const hasDraftFilters =
    draftCategories.length > 0 || draftMin !== "" || draftMax !== "";

  return (
    <aside className="sf-surface sf-card-shadow h-fit overflow-hidden lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-[var(--sf-line)] px-5 py-4">
        <div>
          <h2 className="sf-display text-lg font-semibold text-[var(--sf-ink)]">
            Filters
          </h2>
          <p className="mt-0.5 text-xs text-[var(--sf-soft)]">
            Refine product results
          </p>
        </div>
        {hasDraftFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-[var(--sf-accent)] hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="space-y-6 p-5">
        <fieldset>
          <legend className="text-sm font-semibold text-[var(--sf-ink)]">
            Categories
          </legend>
          <div className="mt-3 max-h-56 space-y-2.5 overflow-y-auto pr-1">
            {categories.length === 0 ? (
              <p className="text-sm text-[var(--sf-soft)]">
                No categories available
              </p>
            ) : (
              categories.map((category) => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-3 text-sm text-[var(--sf-muted)]"
                >
                  <input
                    type="checkbox"
                    checked={draftCategories.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="h-4 w-4 rounded border-[var(--sf-line)] accent-[var(--sf-accent)]"
                  />
                  <span>{category.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        <fieldset className="border-t border-[var(--sf-line)] pt-5">
          <legend className="text-sm font-semibold text-[var(--sf-ink)]">
            Wholesale price
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1.5 block text-xs text-[var(--sf-soft)]">
                Minimum
              </span>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--sf-soft)]">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftMin}
                  onChange={(event) => setDraftMin(event.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-[var(--sf-line)] bg-[#fbfdfc] py-2.5 pr-2 pl-7 text-sm text-[var(--sf-ink)] focus:border-[var(--sf-accent)] focus:outline-none"
                />
              </div>
            </label>
            <label>
              <span className="mb-1.5 block text-xs text-[var(--sf-soft)]">
                Maximum
              </span>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--sf-soft)]">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftMax}
                  onChange={(event) => setDraftMax(event.target.value)}
                  placeholder="Any"
                  className="w-full rounded-xl border border-[var(--sf-line)] bg-[#fbfdfc] py-2.5 pr-2 pl-7 text-sm text-[var(--sf-ink)] focus:border-[var(--sf-accent)] focus:outline-none"
                />
              </div>
            </label>
          </div>
          {priceError ? (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {priceError}
            </p>
          ) : null}
        </fieldset>

        <button
          type="button"
          onClick={applyFilters}
          className="w-full rounded-xl bg-[var(--sf-accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--sf-accent-hover)] hover:shadow-md"
        >
          Apply filters
        </button>
      </div>
    </aside>
  );
}
