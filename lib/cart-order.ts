/**
 * lib/cart-order.ts
 *
 * Turns the cart into a WhatsApp order message to the seller. This is the
 * "checkout" for the inquiry-style storefront (no online payment): the buyer
 * is handed off to WhatsApp with a pre-filled order summary.
 */

import type { CartItem } from "./use-cart";
import { cartSubtotal } from "./use-cart";

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Pick the seller phone to send the order to. All lines normally share the
 * same company, so we use the first line that has a usable phone number.
 */
function sellerPhone(items: CartItem[]): string | null {
  for (const item of items) {
    const digits = (item.companyPhone ?? "").replace(/\D/g, "");
    if (digits.length >= 8) return digits;
  }
  return null;
}

function sellerName(items: CartItem[]): string {
  return items.find((i) => i.companyName)?.companyName ?? "there";
}

/** Customer-provided delivery details collected at checkout. */
export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
}

/** Whether the seller is reachable (a valid WhatsApp number exists). */
export function hasSellerPhone(items: CartItem[]): boolean {
  return sellerPhone(items) !== null;
}

/**
 * Build a wa.me link containing the full order summary plus the customer's
 * delivery details, or null when no valid seller phone is available (caller
 * should fall back to the inquiry form).
 */
export function buildWhatsAppOrderHref(
  items: CartItem[],
  customer?: CustomerDetails
): string | null {
  if (items.length === 0) return null;
  const digits = sellerPhone(items);
  if (!digits) return null;

  const lines = items.map((item, i) => {
    const variant = item.variant ? ` (${item.variant})` : "";
    const lineTotal = formatPrice(item.price * item.qty);
    return `${i + 1}. ${item.name}${variant} \u00d7 ${item.qty} \u2014 ${lineTotal}`;
  });

  const total = formatPrice(cartSubtotal(items));

  const parts: string[] = [
    `Hi ${sellerName(items)}, I'd like to order:`,
    "",
    ...lines,
    "",
    `Total: ${total}`,
  ];

  if (customer) {
    parts.push(
      "",
      "--- Delivery details ---",
      `Name: ${customer.name}`,
      `Phone: ${customer.phone}`,
      `Address: ${customer.address}`
    );
  }

  parts.push("", "Please confirm availability and delivery.");

  return `https://wa.me/${digits}?text=${encodeURIComponent(parts.join("\n"))}`;
}
