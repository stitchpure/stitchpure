import type { Metadata } from "next";

import { SITE_NAME, SITE_CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with ${SITE_NAME} — WhatsApp, email or phone.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const waDigits = SITE_CONTACT.whatsapp.replace(/\D/g, "");
  const waHref =
    waDigits.length >= 8
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          `Hi ${SITE_NAME}, I have a question.`
        )}`
      : null;

  return (
    <article className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="border-b border-[var(--sf-line)] pb-6">
        <h1 className="sf-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-[var(--sp-ink)] sm:text-4xl">
          Contact us
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--sf-muted)] sm:text-base">
          Questions about an order, sizing, or anything else? We&apos;re happy
          to help — reach us the fastest way for you.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* WhatsApp */}
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="sf-surface sf-card-shadow flex flex-col gap-1 p-6 transition-transform hover:-translate-y-0.5"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-soft)]">
              WhatsApp
            </span>
            <span className="sf-display text-lg font-bold text-[var(--sp-ink)]">
              Chat with us
            </span>
            <span className="text-sm text-[var(--sf-muted)]">
              Fastest way to reach us
            </span>
          </a>
        ) : null}

        {/* Email */}
        <a
          href={`mailto:${SITE_CONTACT.email}`}
          className="sf-surface sf-card-shadow flex flex-col gap-1 p-6 transition-transform hover:-translate-y-0.5"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-soft)]">
            Email
          </span>
          <span className="sf-display text-lg font-bold text-[var(--sp-ink)]">
            {SITE_CONTACT.email}
          </span>
          <span className="text-sm text-[var(--sf-muted)]">
            We reply within 1–2 working days
          </span>
        </a>

        {/* Phone */}
        <a
          href={`tel:${SITE_CONTACT.phone.replace(/\s/g, "")}`}
          className="sf-surface sf-card-shadow flex flex-col gap-1 p-6 transition-transform hover:-translate-y-0.5"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-soft)]">
            Phone
          </span>
          <span className="sf-display text-lg font-bold text-[var(--sp-ink)]">
            {SITE_CONTACT.phone}
          </span>
          <span className="text-sm text-[var(--sf-muted)]">
            Mon–Sat, 10am–6pm
          </span>
        </a>

        {/* Address */}
        <div className="sf-surface sf-card-shadow flex flex-col gap-1 p-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-soft)]">
            Address
          </span>
          <span className="sf-display text-lg font-bold text-[var(--sp-ink)]">
            {SITE_NAME}
          </span>
          <span className="text-sm text-[var(--sf-muted)]">
            {SITE_CONTACT.address}
          </span>
        </div>
      </div>
    </article>
  );
}
