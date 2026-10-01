"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  useCart,
  updateQty,
  removeFromCart,
  clearCart,
  cartSubtotal,
} from "@/lib/use-cart";
import {
  buildWhatsAppOrderHref,
  hasSellerPhone,
  type CustomerDetails,
} from "@/lib/cart-order";
import { trackEvent } from "@/lib/analytics";

const PLACEHOLDER = "/placeholder-product.svg";

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

type Step = "cart" | "checkout";

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const items = useCart();
  const subtotal = cartSubtotal(items);
  const canOrder = hasSellerPhone(items);

  const [step, setStep] = useState<Step>("cart");

  // Customer delivery details (collected before the WhatsApp handoff).
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStep("cart");
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Derive the effective step: never show checkout for an empty cart.
  const effectiveStep: Step = items.length === 0 ? "cart" : step;

  // Reset to the cart step as we close, so reopening starts fresh.
  function handleClose() {
    setStep("cart");
    onClose();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Please enter your name";
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8) next.phone = "Enter a valid phone number";
    if (address.trim().length < 10)
      next.address = "Enter your full delivery address";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handlePlaceOrder() {
    if (!validate()) return;
    const customer: CustomerDetails = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };
    const href = buildWhatsAppOrderHref(items, customer);
    if (!href) return;

    trackEvent("begin_checkout_whatsapp", {
      items: items.length,
      value: subtotal,
    });

    // Open WhatsApp with the pre-filled order.
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const field =
    "w-full rounded-xl border border-[var(--sf-line)] bg-white px-4 py-3 text-sm text-[var(--sp-ink)] placeholder:text-[var(--sf-soft)] focus:border-[var(--sp-ink)] focus:outline-none";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Side panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-md flex-col bg-[var(--sp-paper)] shadow-[0_0_60px_rgba(16,16,15,0.3)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--sf-line)] px-5 py-4">
          <div className="flex items-center gap-2">
            {effectiveStep === "checkout" ? (
              <button
                type="button"
                onClick={() => setStep("cart")}
                aria-label="Back to cart"
                className="rounded-full p-1 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <h2 className="sf-display text-lg font-extrabold uppercase tracking-tight text-[var(--sp-ink)]">
              {effectiveStep === "checkout" ? "Delivery details" : "Your cart"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close cart"
            className="rounded-full p-2 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)]"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-[var(--sf-soft)]">Your cart is empty.</p>
            <Link href="/#catalog" onClick={handleClose} className="sp-btn sp-btn--dark">
              Browse products
            </Link>
          </div>
        ) : effectiveStep === "cart" ? (
          /* ── Step 1: cart items ─────────────────────────────────────────── */
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={`${item.productId}__${item.variant}`} className="flex gap-3">
                    <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#ece9e2]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || PLACEHOLDER}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (!el.src.endsWith(PLACEHOLDER)) el.src = PLACEHOLDER;
                        }}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--sp-ink)]">
                        {item.name}
                      </p>
                      {item.variant ? (
                        <p className="mt-0.5 text-xs text-[var(--sf-soft)]">{item.variant}</p>
                      ) : null}
                      <p className="mt-0.5 text-sm text-[var(--sf-muted)]">
                        {formatPrice(item.price)}
                      </p>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center rounded-lg border border-[var(--sf-line)]">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => updateQty(item.productId, item.variant, item.qty - 1)}
                            className="px-2.5 py-1 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)]"
                          >
                            −
                          </button>
                          <span className="min-w-[2rem] text-center text-sm font-semibold text-[var(--sp-ink)]">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => updateQty(item.productId, item.variant, item.qty + 1)}
                            className="px-2.5 py-1 text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)]"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId, item.variant)}
                          className="text-xs font-medium text-[var(--sf-soft)] underline-offset-2 hover:text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-[var(--sp-ink)]">
                      {formatPrice(item.price * item.qty)}
                    </p>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={clearCart}
                className="mt-5 text-xs font-medium text-[var(--sf-soft)] hover:text-red-600 hover:underline"
              >
                Clear cart
              </button>
            </div>

            <div className="border-t border-[var(--sf-line)] px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-[var(--sf-soft)]">
                  Subtotal
                </span>
                <span className="sf-display text-xl font-extrabold text-[var(--sp-ink)]">
                  {formatPrice(subtotal)}
                </span>
              </div>

              {canOrder ? (
                <button
                  type="button"
                  onClick={() => setStep("checkout")}
                  className="sp-btn sp-btn--dark w-full justify-center !py-4 text-sm uppercase tracking-widest"
                >
                  Proceed to checkout
                </button>
              ) : (
                <p className="rounded-lg bg-[#f3f2ee] px-4 py-3 text-center text-xs text-[var(--sf-soft)]">
                  Ordering is unavailable right now. Please use the enquiry form
                  on a product page.
                </p>
              )}
            </div>
          </>
        ) : (
          /* ── Step 2: delivery details ───────────────────────────────────── */
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-4 text-sm text-[var(--sf-muted)]">
                Enter your details. We&apos;ll confirm your order and delivery on
                WhatsApp — no online payment.
              </p>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[var(--sf-muted)]">
                    Full name *
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={field}
                  />
                  {errors.name ? (
                    <span className="text-xs text-red-600">{errors.name}</span>
                  ) : null}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[var(--sf-muted)]">
                    Phone number *
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    inputMode="tel"
                    className={field}
                  />
                  {errors.phone ? (
                    <span className="text-xs text-red-600">{errors.phone}</span>
                  ) : null}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[var(--sf-muted)]">
                    Delivery address *
                  </span>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House / flat, street, area, city, state, pincode"
                    rows={4}
                    className={`${field} resize-y`}
                  />
                  {errors.address ? (
                    <span className="text-xs text-red-600">{errors.address}</span>
                  ) : null}
                </label>
              </div>
            </div>

            <div className="border-t border-[var(--sf-line)] px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-[var(--sf-soft)]">
                  Total
                </span>
                <span className="sf-display text-xl font-extrabold text-[var(--sp-ink)]">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                className="sp-btn sp-btn--dark w-full justify-center !py-4 text-sm uppercase tracking-widest"
              >
                Order on WhatsApp
              </button>
              <p className="mt-2 text-center text-xs text-[var(--sf-soft)]">
                Your order and address will be sent to us on WhatsApp.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
