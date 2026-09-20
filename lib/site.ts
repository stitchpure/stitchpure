/**
 * Canonical site configuration used for SEO (metadata, canonical URLs,
 * sitemap, robots and structured data).
 *
 * Set NEXT_PUBLIC_SITE_URL in the environment (e.g. on Vercel) to override
 * the default production domain. No trailing slash.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://stitchpure.com"
).replace(/\/$/, "");

export const SITE_NAME = "StitchPure";

/** Build an absolute URL for a given path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
