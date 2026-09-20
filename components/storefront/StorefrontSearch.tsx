"use client";

import { useEffect, useRef, useState } from "react";

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 500;

interface StorefrontSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

/** Commit search only when empty (clear) or at least 3 characters. */
function toCommittedSearch(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length < MIN_SEARCH_LENGTH) return "";
  return trimmed;
}

export default function StorefrontSearch({
  value,
  onChange,
  placeholder = "Search products (min. 3 letters)…",
  label = "Search products",
}: StorefrontSearchProps) {
  const [localValue, setLocalValue] = useState(value);
  const committedRef = useRef(toCommittedSearch(value));
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync from URL only when external value changes (back/forward), not while typing
  useEffect(() => {
    const external = toCommittedSearch(value);
    if (external !== committedRef.current) {
      committedRef.current = external;
      setLocalValue(value);
    }
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = toCommittedSearch(localValue);
      if (next === committedRef.current) return;
      committedRef.current = next;
      onChangeRef.current(next);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [localValue]);

  const trimmed = localValue.trim();
  const showHint =
    trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH;

  return (
    <label className="relative block w-full pb-0">
      <span className="sr-only">{label}</span>
      <svg
        className="pointer-events-none absolute top-6 left-4 z-10 h-4 w-4 -translate-y-1/2 text-[var(--sf-soft)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-transparent bg-[#f3f7f5] py-3 pr-4 pl-11 text-sm text-[var(--sf-ink)] placeholder:text-[var(--sf-soft)] transition-all duration-200 focus:border-[var(--sf-accent)]/25 focus:bg-white focus:outline-none focus:ring-3 focus:ring-[var(--sf-accent)]/10"
        aria-describedby={showHint ? "storefront-search-hint" : undefined}
      />
      {showHint ? (
        <span
          id="storefront-search-hint"
          className="mt-1.5 block pl-1 text-xs text-[var(--sf-soft)]"
        >
          Type at least {MIN_SEARCH_LENGTH} letters to search
        </span>
      ) : null}
    </label>
  );
}
