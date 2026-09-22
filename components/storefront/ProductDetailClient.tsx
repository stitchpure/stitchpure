"use client";

import { useEffect, useMemo, useState } from "react";

import ProductGallery from "./ProductGallery";
import type { StorefrontOption } from "@/services/storefront.service";

interface ProductDetailClientProps {
  productName: string;
  categoryName: string | null;
  description: string | null;
  price: number;
  images: string[] | null;
  companyName: string;
  companyPhone: string | null;
  options: StorefrontOption[];
  availableQuantity: number;
}

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 transition-transform ${open ? "rotate-45" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--sf-line)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--sp-ink)]">
          {title}
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="pb-5 text-sm leading-relaxed text-[var(--sf-muted)] whitespace-pre-wrap">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function FeatureStrip() {
  const items = [
    { label: "Free shipping", sub: "Orders over ₹999" },
    { label: "7-day returns", sub: "Easy & hassle-free" },
    { label: "Secure", sub: "Safe checkout" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--sf-line)] bg-white/70 p-3 text-center">
      {items.map((it) => (
        <div key={it.label} className="px-1">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--sp-ink)]">
            {it.label}
          </p>
          <p className="mt-0.5 text-[0.68rem] text-[var(--sf-soft)]">{it.sub}</p>
        </div>
      ))}
    </div>
  );
}

export default function ProductDetailClient({
  productName,
  categoryName,
  description,
  price,
  images,
  companyName,
  companyPhone,
  options,
  availableQuantity,
}: ProductDetailClientProps) {
  // Track selected value per option id
  const [selected, setSelected] = useState<Record<string, string>>({});

  const requiredMissing = options.filter((o) => !selected[o.id]);

  // Build a human-readable summary of the selection for the inquiry message
  const selectionSummary = useMemo(() => {
    const parts = options
      .map((o) => {
        const val = selected[o.id];
        if (!val) return null;
        const label = o.values.find((v) => v.id === val)?.value;
        return label ? `${o.name}: ${label}` : null;
      })
      .filter(Boolean);
    return parts.join(", ");
  }, [options, selected]);

  const whatsappHref = useMemo(() => {
    if (!companyPhone) return null;
    const digits = companyPhone.replace(/\D/g, "");
    if (digits.length < 8) return null;
    const detail = selectionSummary ? ` (${selectionSummary})` : "";
    const text = `Hi ${companyName}, I'm interested in: ${productName}${detail}. Is it available?`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }, [companyPhone, companyName, productName, selectionSummary]);

  // Show the floating CTA until the user reaches the enquiry form.
  const [showFloatingCta, setShowFloatingCta] = useState(true);

  useEffect(() => {
    function update() {
      const el = document.getElementById("inquiry");
      if (!el) {
        setShowFloatingCta(true);
        return;
      }
      const top = el.getBoundingClientRect().top;
      // Show the CTA until the enquiry form actually enters the viewport.
      setShowFloatingCta(top > window.innerHeight - 120);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scrollToInquiry() {
    const el = document.getElementById("inquiry");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <>
    <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
      <ProductGallery images={images} name={productName} />

      <div className="space-y-6">
        {categoryName ? (
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--sf-soft)]">
            {categoryName}
          </p>
        ) : null}

        <div className="space-y-2">
          <h1 className="sf-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-[var(--sp-ink)] sm:text-4xl">
            {productName}
          </h1>
          <p className="sf-display text-2xl font-extrabold text-[var(--sp-ink)]">
            {formatPrice(price)}
          </p>
          <p className="text-xs text-[var(--sf-soft)]">Inclusive of all taxes.</p>

          {/* Stock availability */}
          {availableQuantity <= 0 ? (
            <p className="text-sm font-bold uppercase tracking-wide text-red-600">
              Out of stock
            </p>
          ) : availableQuantity <= 5 ? (
            <p className="text-sm font-bold uppercase tracking-wide text-red-600">
              Only {availableQuantity} left
            </p>
          ) : (
            <p className="text-sm font-semibold text-emerald-600">In stock</p>
          )}
        </div>

        {/* Variant / size selectors */}
        {options.map((option) => (
          <div key={option.id} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wide text-[var(--sp-ink)]">
                {option.name}
              </span>
              {selected[option.id] ? (
                <span className="text-xs text-[var(--sf-soft)]">
                  {option.values.find((v) => v.id === selected[option.id])?.value}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {option.values.map((val) => {
                const isSel = selected[option.id] === val.id;
                if (option.type === "COLOR" && val.colorCode) {
                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() =>
                        setSelected((s) => ({ ...s, [option.id]: val.id }))
                      }
                      title={val.value}
                      aria-label={val.value}
                      className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                        isSel
                          ? "border-[var(--sp-ink)] ring-2 ring-[var(--sp-ink)]/20"
                          : "border-[var(--sf-line)]"
                      }`}
                      style={{ backgroundColor: val.colorCode }}
                    />
                  );
                }
                return (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() =>
                      setSelected((s) => ({ ...s, [option.id]: val.id }))
                    }
                    className={`min-w-[3rem] rounded-xl border px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                      isSel
                        ? "border-[var(--sp-ink)] bg-[var(--sp-ink)] text-[var(--sp-paper)]"
                        : "border-[var(--sf-line)] bg-white text-[var(--sp-ink)] hover:border-[var(--sp-ink)]"
                    }`}
                  >
                    {val.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Primary CTA — WhatsApp enquiry (carries selected variant) */}
        <div className="space-y-2.5 pt-1">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="sp-btn sp-btn--dark w-full justify-center !py-4 text-sm uppercase tracking-widest"
            >
              Enquire on WhatsApp
            </a>
          ) : (
            <a
              href="#inquiry"
              onClick={(e) => {
                e.preventDefault();
                scrollToInquiry();
              }}
              className="sp-btn sp-btn--dark w-full justify-center !py-4 text-sm uppercase tracking-widest"
            >
              Send an enquiry
            </a>
          )}

          {options.length > 0 && requiredMissing.length > 0 ? (
            <p className="text-center text-xs text-[var(--sf-soft)]">
              Tip: pick your {requiredMissing.map((o) => o.name.toLowerCase()).join(" & ")} so we can help faster.
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Coming soon"
              aria-label="Add to cart (coming soon)"
              className="relative inline-flex flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-[var(--sf-line)] bg-[#f3f2ee] px-4 py-3 text-sm font-semibold text-[var(--sf-soft)]"
            >
              Add to cart
              <span className="absolute -right-2 -top-2 rounded-full bg-[var(--sp-lime)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[var(--sp-ink)] shadow-sm">
                Coming soon
              </span>
            </button>
            <a
              href="#inquiry"
              onClick={(e) => {
                e.preventDefault();
                scrollToInquiry();
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[var(--sf-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-ink)]"
            >
              Enquiry form
            </a>
          </div>
        </div>

        <FeatureStrip />

        {/* Collapsible info */}
        <div className="pt-2">
          {description?.trim() ? (
            <Collapsible title="Description" defaultOpen>
              {description}
            </Collapsible>
          ) : null}
          <Collapsible title="Shipping & Returns">
            Free shipping on orders over ₹999. Orders dispatched within 24–48
            hours. Easy 7-day returns on unused items with tags intact.
          </Collapsible>
          <Collapsible title="Care Guide">
            Machine wash cold with like colours. Do not bleach. Tumble dry low.
            Warm iron if needed. Avoid ironing over prints.
          </Collapsible>
        </div>
      </div>
    </div>

    {/* Floating CTA — jump to the enquiry form (hidden once the form is in view) */}
    <button
      type="button"
      onClick={scrollToInquiry}
      aria-label="Go to enquiry form"
      className={`group fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full bg-[var(--sp-lime)] py-3.5 pl-5 pr-4 text-sm font-extrabold uppercase tracking-widest text-[var(--sp-ink)] shadow-[0_12px_30px_rgba(16,16,15,0.35)] transition-all duration-300 hover:-translate-y-0.5 sm:bottom-8 sm:right-8 ${
        showFloatingCta
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="hidden sm:inline">Enquire</span>
      <svg
        className="h-5 w-5 transition-transform group-hover:translate-y-0.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 6-6m-6 6-6-6" />
      </svg>
    </button>
    </>
  );
}
