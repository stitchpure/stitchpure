"use client";

import { generateQueryHref } from "@/lib/storefront-utils";

interface QueryCTAProps {
  email: string;
  productName: string;
  companyName: string;
}

export default function QueryCTA({
  email,
  productName,
  companyName,
}: QueryCTAProps) {
  return (
    <a
      href={generateQueryHref(email, productName)}
      className="inline-flex flex-1 items-center justify-center rounded-md bg-[var(--sf-accent)] px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--sf-accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-accent)] focus-visible:ring-offset-2"
      aria-label={`Send query to ${companyName} about ${productName}`}
    >
      Send Query
    </a>
  );
}
