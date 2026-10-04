import type { ReactNode } from "react";

/**
 * Shared layout for static policy / information pages (Shipping, Returns,
 * Privacy, Terms, About). Keeps a consistent heading + prose style across the
 * storefront.
 */
export default function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  /** Optional "last updated" label, e.g. "January 2025". */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="border-b border-[var(--sf-line)] pb-6">
        <h1 className="sf-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-[var(--sp-ink)] sm:text-4xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--sf-muted)] sm:text-base">
            {intro}
          </p>
        ) : null}
        {updated ? (
          <p className="mt-2 text-xs text-[var(--sf-soft)]">
            Last updated: {updated}
          </p>
        ) : null}
      </header>

      <div className="sf-legal-prose mt-8 space-y-8">{children}</div>
    </article>
  );
}

/** A titled section within a legal page. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="sf-display text-lg font-bold uppercase tracking-wide text-[var(--sp-ink)]">
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-[var(--sf-muted)]">
        {children}
      </div>
    </section>
  );
}
