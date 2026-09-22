"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StorefrontProduct } from "@/types/storefront";

const PLACEHOLDER = "/placeholder-product.svg";
const MIN_LEN = 2;
const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;
const MAX_PRODUCTS = 6;

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Build lightweight query suggestions from returned product names. */
function buildSuggestions(query: string, products: StorefrontProduct[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of products) {
    // Collect individual words + short phrases from product names that contain the query
    const words = p.name.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      if (!words[i].includes(q) && !q.includes(words[i])) continue;
      // phrase = matching word + next word (mirrors "dark polo t" style)
      const phrase = words.slice(i, Math.min(i + 3, words.length)).join(" ");
      if (!phrase.includes(q)) continue;
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      out.push(phrase);
      if (out.length >= MAX_SUGGESTIONS) return out;
    }
  }
  return out;
}

/** Split text into parts, marking segments that match the query for highlighting. */
function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return [{ text, match: false }];
  return [
    { text: text.slice(0, idx), match: false },
    { text: text.slice(idx, idx + q.length), match: true },
    { text: text.slice(idx + q.length), match: false },
  ].filter((part) => part.text.length > 0);
}

export default function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the overlay opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on Escape; lock body scroll while open
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Debounced product fetch
  useEffect(() => {
    const q = query.trim();
    const controller = new AbortController();

    if (q.length < MIN_LEN) {
      const clearTimer = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const loadingTimer = window.setTimeout(() => setLoading(true), 0);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          limit: String(MAX_PRODUCTS),
          search: q,
        });
        const res = await fetch(`/api/storefront/products?${params}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted) return;
        setResults(res.ok && json.success ? json.data : []);
        setTouched(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(loadingTimer);
      window.clearTimeout(timer);
    };
  }, [query]);

  const suggestions = useMemo(
    () => buildSuggestions(query, results),
    [query, results]
  );

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setTouched(false);
  }

  function submitSearch(term: string) {
    const q = term.trim();
    if (q.length < MIN_LEN) return;
    close();
    router.push(`/?search=${encodeURIComponent(q)}`);
  }

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_LEN;

  return (
    <div ref={wrapRef} className="contents">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search products"
        aria-expanded={open}
        className="rounded-full p-2.5 text-[var(--sp-ink)] transition-colors hover:bg-[var(--sf-accent-soft)] hover:text-[var(--sf-accent)]"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3m1.8-4.7a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
      </button>

      {open ? (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={close}
          />

          {/* Overlay panel: drops from the top, full width */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Product search"
            className="fixed inset-x-0 top-0 z-50 max-h-[100dvh] overflow-y-auto rounded-b-2xl bg-white shadow-[0_24px_60px_rgba(16,16,15,0.22)]"
          >
            <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
              {/* Search bar row */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSearch(query);
                }}
                className="flex items-center gap-2 sm:gap-3"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products…"
                    autoComplete="off"
                    className="w-full rounded-md border border-[var(--sp-ink)] bg-white px-3 py-2.5 text-base text-[var(--sp-ink)] placeholder:text-[var(--sf-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]/25 [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>

                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="shrink-0 rounded-full p-2 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}

                <span className="hidden h-6 w-px bg-[var(--sf-line)] sm:block" aria-hidden="true" />

                <button
                  type="submit"
                  aria-label="Search"
                  className="shrink-0 rounded-full p-2 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)] hover:text-[var(--sf-accent)]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3m1.8-4.7a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={close}
                  aria-label="Close search"
                  className="ml-1 shrink-0 rounded-full p-2 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)]"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>

              {/* Results area */}
              {hasQuery ? (
                <div className="mt-5 grid gap-6 sm:mt-6 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-10">
                  {/* Suggestions column */}
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--sf-soft)]">
                      Suggestions
                    </p>
                    {suggestions.length > 0 ? (
                      <ul className="mt-3 space-y-2.5">
                        {suggestions.map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              onClick={() => submitSearch(s)}
                              className="text-left text-sm text-[var(--sp-ink)] hover:underline"
                            >
                              {highlightParts(s, trimmed).map((part, i) =>
                                part.match ? (
                                  <mark
                                    key={i}
                                    className="rounded-[2px] bg-[#fff05a] px-0.5 text-[var(--sp-ink)]"
                                  >
                                    {part.text}
                                  </mark>
                                ) : (
                                  <span key={i}>{part.text}</span>
                                )
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--sf-soft)]">
                        {loading ? "Loading…" : "No suggestions"}
                      </p>
                    )}
                  </div>

                  {/* Products column */}
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--sf-soft)]">
                      Products
                    </p>
                    {loading && results.length === 0 ? (
                      <p className="mt-4 text-sm text-[var(--sf-soft)]">Searching…</p>
                    ) : results.length === 0 ? (
                      touched ? (
                        <p className="mt-4 text-sm text-[var(--sf-soft)]">
                          No products found for “{trimmed}”.
                        </p>
                      ) : null
                    ) : (
                      <ul className="mt-2 divide-y divide-[var(--sf-line)]">
                        {results.slice(0, MAX_PRODUCTS).map((p) => {
                          const img = (p.images ?? [])[0] || PLACEHOLDER;
                          const href = p.productId
                            ? `/storefront/p/${p.productId}`
                            : "/";
                          return (
                            <li key={p.id}>
                              <Link
                                href={href}
                                onClick={close}
                                className="flex items-center gap-4 py-3 transition-colors hover:bg-[var(--sf-accent-soft)]/40"
                              >
                                <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-[#ece9e2]">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img}
                                    alt={p.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      const el = e.currentTarget;
                                      if (!el.src.endsWith(PLACEHOLDER))
                                        el.src = PLACEHOLDER;
                                    }}
                                  />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-[var(--sp-ink)]">
                                    {p.name}
                                  </span>
                                  <span className="mt-0.5 block text-sm text-[var(--sf-soft)]">
                                    {formatPrice(Number(p.wholesalePrice) || 0)}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Search-for footer */}
                    <button
                      type="button"
                      onClick={() => submitSearch(query)}
                      className="mt-4 flex w-full items-center justify-between border-t border-[var(--sf-line)] pt-4 text-sm font-semibold text-[var(--sp-ink)] hover:text-[var(--sf-accent)]"
                    >
                      <span>Search for “{trimmed}”</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16m0 0-6-6m6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--sf-soft)]">
                  Type at least {MIN_LEN} letters to search.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
