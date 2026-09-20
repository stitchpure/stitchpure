"use client";

import { FormEvent, useState } from "react";

interface InquiryFormProps {
  companyId: string;
  productId?: string | null;
  productName?: string;
  companyName: string;
}

export default function InquiryForm({
  companyId,
  productId = null,
  productName,
  companyName,
}: InquiryFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    productName
      ? `Hi, I'm interested in wholesale pricing for ${productName}.`
      : `Hi, I'd like to inquire about wholesale products from ${companyName}.`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/storefront/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          productId: productId || null,
          name,
          phone,
          email: email || "",
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? "Failed to send inquiry");
        return;
      }
      setSuccess(true);
      setName("");
      setPhone("");
      setEmail("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        id="inquiry"
        className="sf-surface sf-card-shadow p-6 sm:p-8"
      >
        <p className="sf-display text-lg font-semibold text-[var(--sf-ink)]">
          Inquiry sent
        </p>
        <p className="mt-2 text-sm text-[var(--sf-muted)]">
          {companyName} will get back to you soon.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-4 text-sm font-medium text-[var(--sf-accent)] hover:underline"
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-[var(--sf-line)] bg-[#fbfdfc] px-4 py-3 text-sm text-[var(--sf-ink)] placeholder:text-[var(--sf-soft)] transition-all focus:border-[var(--sf-accent)]/40 focus:bg-white focus:outline-none focus:ring-3 focus:ring-[var(--sf-accent)]/10";

  return (
    <form
      id="inquiry"
      onSubmit={onSubmit}
      className="sf-surface sf-card-shadow space-y-5 p-6 sm:p-8"
    >
      <div>
        <p className="sf-eyebrow">Direct to seller</p>
        <h2 className="sf-display mt-3 text-2xl font-semibold tracking-[-0.025em] text-[var(--sf-ink)]">
          Request wholesale details
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-muted)]">
          Share your details and {companyName} will respond directly.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--sf-muted)]">
            Your name *
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
            placeholder="Full name"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--sf-muted)]">
            Phone *
          </span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={field}
            placeholder="+91…"
            inputMode="tel"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--sf-muted)]">
          Email (optional)
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="you@example.com"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--sf-muted)]">
          Message *
        </span>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${field} resize-y`}
        />
      </label>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[var(--sf-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--sf-accent-hover)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Submit inquiry"}
      </button>
    </form>
  );
}
