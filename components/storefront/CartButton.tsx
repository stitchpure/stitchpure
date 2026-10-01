"use client";

import { useState } from "react";

import { useCart, cartItemCount } from "@/lib/use-cart";
import CartDrawer from "./CartDrawer";

export default function CartButton() {
  const [open, setOpen] = useState(false);
  const items = useCart();
  const count = cartItemCount(items);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
        className="relative rounded-full p-2.5 text-[var(--sp-ink)] transition-colors hover:bg-[var(--sf-accent-soft)] hover:text-[var(--sf-accent)]"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m-3 0h13.5l-.75 9a1.5 1.5 0 0 1-1.5 1.35H7.5A1.5 1.5 0 0 1 6 19.5l-.75-9Z" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--sp-ink)] px-1 text-[0.65rem] font-bold text-[var(--sp-lime)]">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
