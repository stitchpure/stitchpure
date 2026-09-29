/**
 * lib/analytics.ts
 *
 * Thin wrapper around the Google Analytics 4 `gtag` function for sending
 * custom events from client components. Safe to call anywhere: if gtag isn't
 * loaded (e.g. GA not configured, or on the server) it silently no-ops.
 */

declare global {
  interface Window {
    // gtag is injected by the GA4 script tag in app/layout.tsx
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Send a custom GA4 event.
 *
 * @param name   Event name (e.g. "select_product", "click_shop_now").
 * @param params Optional key/value details shown in GA reports.
 */
export function trackEvent(
  name: string,
  params: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
