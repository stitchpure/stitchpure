"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StorefrontProduct } from "@/types/storefront";

const PLACEHOLDER = "/placeholder-product.svg";
const MIN_LEN = 2;
const DEBOUNCE_MS = 300;

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when the search opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Debounced fetch — all state updates happen inside the timeout callback
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
          limit: "8",
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

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setTouched(false);
  }

  const showDropdown = open && query.trim().length >= MIN_LEN;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
          {/* Desktop backdrop (click-away) */}
          <div
            className="fixed inset-0 z-40 hidden sm:block"
            aria-hidden="true"
            onClick={close}
          />
          <div className="fixed inset-0 z-[60] flex h-screen w-screen flex-col bg-white p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+0.6rem)] sm:z-50 sm:h-auto sm:w-[26rem] sm:flex-none sm:rounded-2xl sm:border sm:border-[var(--sf-line)] sm:p-3 sm:shadow-[0_20px_60px_rgba(16,16,15,0.18)]">
          {/* Mobile top bar: search field + close */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sf-soft)]"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-xl border border-[var(--sf-line)] bg-[#f3f7f5] py-3 pl-9 pr-3 text-base text-[var(--sp-ink)] placeholder:text-[var(--sf-soft)] focus:border-[var(--sf-accent)]/30 focus:bg-white focus:outline-none sm:py-2.5 sm:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="shrink-0 rounded-full p-2 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)] sm:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showDropdown ? (
            <div className="mt-3 flex-1 overflow-y-auto sm:max-h-[60vh] sm:flex-none">
              {loading ? (
                <p className="py-6 text-center text-sm text-[var(--sf-soft)]">
                  Searching…
                </p>
              ) : results.length === 0 ? (
                touched ? (
                  <p className="py-6 text-center text-sm text-[var(--sf-soft)]">
                    No products found for “{query.trim()}”.
                  </p>
                ) : null
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  {results.map((p) => {
                    const img = (p.images ?? [])[0] || PLACEHOLDER;
                    const href = p.productId
                      ? `/storefront/p/${p.productId}`
                      : "/";
                    return (
                      <Link
                        key={p.id}
                        href={href}
                        onClick={close}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--sf-line)] bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,16,15,0.12)]"
                      >
                        <span className="relative aspect-square w-full overflow-hidden bg-[#ece9e2]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              const el = e.currentTarget;
                              if (!el.src.endsWith(PLACEHOLDER))
                                el.src = PLACEHOLDER;
                            }}
                          />
                          {p.categoryName ? (
                            <span className="absolute left-2 top-2 rounded-full bg-[var(--sp-ink)]/90 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-[var(--sp-paper)]">
                              {p.categoryName}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center justify-between gap-2 p-3">
                          <span className="sf-display truncate text-sm font-bold uppercase tracking-tight text-[var(--sp-ink)]">
                            {p.name}
                          </span>
                          <span className="sf-display shrink-0 text-sm font-extrabold text-[var(--sp-ink)]">
                            {formatPrice(Number(p.wholesalePrice) || 0)}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 py-4 text-center text-xs text-[var(--sf-soft)]">
              Type at least {MIN_LEN} letters to search.
            </p>
          )}
          </div>
        </>
      ) : null}
    </div>
  );
}
