/**
 * Formatting utilities for the public product storefront.
 *
 * Requirements: 2.1, 2.3, 2.6, 3.2, 3.3, 9.4
 */

/**
 * Truncates text to the specified character limit, appending an ellipsis (…)
 * when the text exceeds the limit.
 *
 * Used for product name (limit 60) and description (limit 120).
 * Requirements: 2.1, 2.3
 */
export function truncateText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  return text.slice(0, limit) + "\u2026";
}

/**
 * Formats a numeric wholesale price with the Indian Rupee symbol and
 * "per piece" label, with exactly two decimal places.
 *
 * Example: formatWholesalePrice(150) → "₹150.00 per piece"
 * Requirement: 2.6
 */
export function formatWholesalePrice(value: number): string {
  return `\u20B9${value.toFixed(2)} per piece`;
}

/**
 * Generates a tel: href for the Call CTA button.
 *
 * Example: generateCallHref("+911234567890") → "tel:+911234567890"
 * Requirement: 3.2
 */
export function generateCallHref(phone: string): string {
  return `tel:${phone}`;
}

/**
 * Generates a mailto: href for the Send Query CTA button with a pre-filled
 * subject line in the format "Wholesale Inquiry: {product name}".
 *
 * Example: generateQueryHref("a@b.com", "Silk Saree") →
 *   "mailto:a@b.com?subject=Wholesale%20Inquiry%3A%20Silk%20Saree"
 * Requirement: 3.3
 */
export function generateQueryHref(email: string, productName: string): string {
  return `mailto:${email}?subject=Wholesale%20Inquiry%3A%20${encodeURIComponent(productName)}`;
}

/**
 * Generates a WhatsApp chat href with a pre-filled wholesale inquiry message.
 * Digits-only phone is used for wa.me; returns null when phone is missing.
 */
export function generateWhatsAppHref(
  phone: string | null | undefined,
  productName: string
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const text = `Hi, I'm interested in wholesale pricing for: ${productName}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Formats the current page range indicator for storefront pagination.
 *
 * Example: formatPageRange(2, 20, 85) → "Showing 21–40 of 85 products"
 * Returns an empty string when total is 0.
 * Requirement: 9.4
 */
export function formatPageRange(
  page: number,
  limit: number,
  total: number,
  noun = "products"
): string {
  if (total === 0) {
    return "";
  }
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return `Showing ${start}\u2013${end} of ${total} ${noun}`;
}
