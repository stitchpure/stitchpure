"use client";

import { generateWhatsAppHref } from "@/lib/storefront-utils";

interface WhatsAppCTAProps {
  phone: string | null;
  productName: string;
  companyName: string;
  compact?: boolean;
}

export default function WhatsAppCTA({
  phone,
  productName,
  companyName,
  compact = false,
}: WhatsAppCTAProps) {
  const href = generateWhatsAppHref(phone, productName);
  const label = href
    ? `WhatsApp ${companyName}`
    : `WhatsApp not available for ${companyName}`;

  const base =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] focus-visible:ring-offset-2";

  if (!href) {
    return (
      <span
        className={`${base} cursor-not-allowed border border-[var(--sf-line)] bg-[#eef2f1] text-[var(--sf-soft)]`}
        title="WhatsApp not available"
        aria-disabled="true"
        aria-label={label}
      >
        {compact ? "WA" : "WhatsApp"}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} border border-[#b7e0c8] bg-[#ecf8f0] text-[#1b6b3a] hover:bg-[#dff3e7]`}
      aria-label={label}
    >
      {compact ? "WA" : "WhatsApp"}
    </a>
  );
}
