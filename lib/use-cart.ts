/**
 * lib/use-cart.ts
 *
 * A tiny localStorage-backed shopping cart for the public storefront.
 *
 * Design notes:
 *  - Uses useSyncExternalStore so components stay in sync without cascading
 *    re-renders, and renders a stable empty cart on the server (no hydration
 *    mismatch).
 *  - All localStorage access is wrapped in try/catch so it degrades gracefully
 *    during SSR or when storage is blocked (mirrors lib/auth.ts house style).
 *  - This is an inquiry-style store (no online payment): the checkout turns the
 *    cart into a WhatsApp message to the seller.
 */

"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "stitchpure_cart_v1";

export interface CartItem {
  /** Product id (storefront product). */
  productId: string;
  /** Product display name. */
  name: string;
  /** Unit price (number, already parsed from the string wholesalePrice). */
  price: number;
  /** First product image, for the cart thumbnail. */
  image: string | null;
  /** Human-readable variant summary, e.g. "Size: M" (empty if none). */
  variant: string;
  /** Quantity in the cart. */
  qty: number;
  /** Seller WhatsApp/phone (digits kept as-is) so checkout can build wa.me. */
  companyPhone: string | null;
  /** Seller name, used in the WhatsApp message. */
  companyName: string;
}

// A stable empty array reference for the server snapshot — returning a new []
// each call would make useSyncExternalStore loop.
const EMPTY: CartItem[] = [];

let cache: CartItem[] = EMPTY;
let cacheRaw: string | null | undefined;

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // SSR or storage blocked — intentionally ignored.
  }
}

/** Parse + validate stored JSON into a clean CartItem[]. */
function parse(raw: string | null): CartItem[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const items = data
      .filter((d): d is CartItem => {
        return (
          typeof d === "object" &&
          d !== null &&
          typeof (d as CartItem).productId === "string" &&
          typeof (d as CartItem).qty === "number"
        );
      })
      .map((d) => ({
        productId: d.productId,
        name: String(d.name ?? ""),
        price: Number(d.price) || 0,
        image: d.image ?? null,
        variant: String(d.variant ?? ""),
        qty: Math.max(1, Math.floor(Number(d.qty) || 1)),
        companyPhone: d.companyPhone ?? null,
        companyName: String(d.companyName ?? ""),
      }));
    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): CartItem[] {
  const raw = readRaw();
  // Keep a stable reference between reads when nothing changed, so
  // useSyncExternalStore doesn't think the store updated every render.
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = parse(raw);
  }
  return cache;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Sync across tabs/windows.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Persist and notify all subscribers in the current tab. */
function commit(items: CartItem[]): void {
  writeRaw(items);
  // Force the next getSnapshot to recompute from the new value.
  cacheRaw = JSON.stringify(items);
  cache = items;
  listeners.forEach((l) => l());
}

/** A line is identified by product + variant combination. */
function sameLine(a: CartItem, productId: string, variant: string): boolean {
  return a.productId === productId && a.variant === variant;
}

// ── Public mutation API (safe to call from event handlers) ──────────────────

export function addToCart(
  item: Omit<CartItem, "qty">,
  qty = 1
): void {
  const current = getSnapshot();
  const idx = current.findIndex((c) => sameLine(c, item.productId, item.variant));
  let next: CartItem[];
  if (idx >= 0) {
    next = current.map((c, i) =>
      i === idx ? { ...c, qty: c.qty + qty } : c
    );
  } else {
    next = [...current, { ...item, qty: Math.max(1, qty) }];
  }
  commit(next);
}

export function updateQty(
  productId: string,
  variant: string,
  qty: number
): void {
  const current = getSnapshot();
  const next =
    qty <= 0
      ? current.filter((c) => !sameLine(c, productId, variant))
      : current.map((c) =>
          sameLine(c, productId, variant) ? { ...c, qty: Math.floor(qty) } : c
        );
  commit(next);
}

export function removeFromCart(productId: string, variant: string): void {
  commit(getSnapshot().filter((c) => !sameLine(c, productId, variant)));
}

export function clearCart(): void {
  commit([]);
}

// ── Derived helpers ─────────────────────────────────────────────────────────

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, c) => sum + c.qty, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, c) => sum + c.price * c.qty, 0);
}

// ── React hook ───────────────────────────────────────────────────────────────

/** Subscribe a component to the cart. Returns the current items array. */
export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
