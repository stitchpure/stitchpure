"use client";

import { generateCallHref } from "@/lib/storefront-utils";

interface CallCTAProps {
  phone: string | null;
  companyName: string;
}

export default function CallCTA({ phone, companyName }: CallCTAProps) {
  const disabled = !phone;
  const label = disabled
    ? `Phone not available for ${companyName}`
    : `Call ${companyName}`;

  const base =
    "inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] focus-visible:ring-offset-2";

  if (disabled) {
    return (
      <span
        className={`${base} cursor-not-allowed border border-[var(--sf-line)] bg-[#eef2f1] text-[var(--sf-soft)]`}
        title="Phone not available"
        aria-disabled="true"
        aria-label={label}
      >
        Call
      </span>
    );
  }

  return (
    <a
      href={generateCallHref(phone)}
      className={`${base} border border-[var(--sf-line)] bg-white text-[var(--sf-ink)] hover:border-[var(--sf-accent)]/40 hover:bg-[var(--sf-accent-soft)]`}
      aria-label={label}
    >
      Call
    </a>
  );
}
