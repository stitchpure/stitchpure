/**
 * Canonical site configuration used for SEO (metadata, canonical URLs,
 * sitemap, robots and structured data).
 *
 * Set NEXT_PUBLIC_SITE_URL in the environment (e.g. on Vercel) to override
 * the default production domain. No trailing slash.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.stitchpure.com"
).replace(/\/$/, "");

export const SITE_NAME = "StitchPure";

/**
 * Public contact details shown on the storefront (Contact page, policy pages,
 * footer). Update these with your real business details — or override via env
 * so you don't need a code change.
 */
export const SITE_CONTACT = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "stitchpureonline@gmail.com",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+91 00000 00000",
  /** WhatsApp number in international format, digits only (for wa.me links). */
  whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "910000000000",
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS || "India",
};

/** Build an absolute URL for a given path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
