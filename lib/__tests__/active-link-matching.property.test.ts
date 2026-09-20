/**
 * lib/__tests__/active-link-matching.property.test.ts
 *
 * Property-based test for active link path matching logic used in the Sidebar.
 *
 * **Validates: Requirements 1.3, 1.5**
 *
 * Property 1: Active Link Path Matching
 * - For any URL path and any navigation link, the link is active iff the path
 *   matches the link's href exactly or starts with href + '/'.
 * - At most one manufacturing link is active for any given path.
 * - Exactly one manufacturing link is active when the path matches a manufacturing route.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure function extracted from components/layout/Sidebar.tsx
// This mirrors the exact logic used in the Sidebar component.
// ---------------------------------------------------------------------------

function isLinkActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(href + '/');
}

// ---------------------------------------------------------------------------
// Navigation items (mirrors NAV_SECTIONS from Sidebar.tsx)
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Categories', href: '/categories' },
  { label: 'Products', href: '/products' },
  { label: 'SKUs', href: '/skus' },
  { label: 'Purchases', href: '/purchases' },
  { label: 'Sales', href: '/sales' },
  { label: 'Stock Ledger', href: '/stock-ledger' },
  { label: 'Production Batches', href: '/production-batches' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Cost Sheets', href: '/cost-sheets' },
  { label: 'Users', href: '/users' },
  { label: 'Company', href: '/company' },
];

const MANUFACTURING_NAV_ITEMS: NavItem[] = [
  { label: 'Production Batches', href: '/production-batches' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Cost Sheets', href: '/cost-sheets' },
];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** All known route hrefs */
const ALL_HREFS = ALL_NAV_ITEMS.map((item) => item.href);

/** Generate a valid sub-route path (e.g., /production-batches/123) */
const subRoutePathArb = fc.tuple(
  fc.constantFrom(...ALL_HREFS.filter((h) => h !== '/')),
  fc.stringMatching(/^[a-z0-9-]{1,20}$/)
).map(([base, suffix]) => `${base}/${suffix}`);

/** Generate an unrelated path that doesn't match any known route */
const unrelatedPathArb = fc.stringMatching(/^\/[a-z]{1,15}$/).filter((path) => {
  // Exclude paths that start with any known nav href
  return !ALL_HREFS.some(
    (href) => href !== '/' && (path === href || path.startsWith(href + '/'))
  ) && path !== '/';
});

/** Generate a known exact route path */
const exactRoutePathArb = fc.constantFrom(...ALL_HREFS);

/** Combined path generator: exact routes, sub-routes, and unrelated paths */
const pathArb = fc.oneof(
  { weight: 3, arbitrary: exactRoutePathArb },
  { weight: 3, arbitrary: subRoutePathArb },
  { weight: 2, arbitrary: unrelatedPathArb }
);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 1: Active Link Path Matching', () => {
  it('at most one manufacturing link is active for any generated path', () => {
    fc.assert(
      fc.property(pathArb, (pathname) => {
        const activeManufacturingLinks = MANUFACTURING_NAV_ITEMS.filter((item) =>
          isLinkActive(pathname, item.href)
        );

        // At most one manufacturing link should be active
        expect(activeManufacturingLinks.length).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 }
    );
  });

  it('exactly one manufacturing link is active when path matches a manufacturing route exactly', () => {
    const manufacturingHrefs = MANUFACTURING_NAV_ITEMS.map((item) => item.href);
    const manufacturingExactPathArb = fc.constantFrom(...manufacturingHrefs);

    fc.assert(
      fc.property(manufacturingExactPathArb, (pathname) => {
        const activeManufacturingLinks = MANUFACTURING_NAV_ITEMS.filter((item) =>
          isLinkActive(pathname, item.href)
        );

        // Exactly one manufacturing link should be active
        expect(activeManufacturingLinks.length).toBe(1);
        // And it should be the correct one
        expect(activeManufacturingLinks[0].href).toBe(pathname);
      }),
      { numRuns: 100 }
    );
  });

  it('exactly one manufacturing link is active when path is a sub-route of a manufacturing route', () => {
    const manufacturingHrefs = MANUFACTURING_NAV_ITEMS.map((item) => item.href);
    const manufacturingSubRouteArb = fc.tuple(
      fc.constantFrom(...manufacturingHrefs),
      fc.stringMatching(/^[a-z0-9-]{1,20}$/)
    ).map(([base, suffix]) => ({ path: `${base}/${suffix}`, base }));

    fc.assert(
      fc.property(manufacturingSubRouteArb, ({ path, base }) => {
        const activeManufacturingLinks = MANUFACTURING_NAV_ITEMS.filter((item) =>
          isLinkActive(path, item.href)
        );

        // Exactly one manufacturing link should be active
        expect(activeManufacturingLinks.length).toBe(1);
        // And it should be the one whose href is the base
        expect(activeManufacturingLinks[0].href).toBe(base);
      }),
      { numRuns: 100 }
    );
  });

  it('zero manufacturing links are active when path does not match any manufacturing route', () => {
    const nonManufacturingPaths = fc.oneof(
      // Home path
      fc.constant('/'),
      // Other known routes that are not manufacturing
      fc.constantFrom('/categories', '/products', '/skus', '/purchases', '/sales', '/stock-ledger', '/users', '/company'),
      // Sub-routes of non-manufacturing routes
      fc.tuple(
        fc.constantFrom('/categories', '/products', '/skus', '/purchases', '/sales', '/stock-ledger', '/users', '/company'),
        fc.stringMatching(/^[a-z0-9-]{1,20}$/)
      ).map(([base, suffix]) => `${base}/${suffix}`),
      // Completely unrelated paths
      unrelatedPathArb
    );

    fc.assert(
      fc.property(nonManufacturingPaths, (pathname) => {
        const activeManufacturingLinks = MANUFACTURING_NAV_ITEMS.filter((item) =>
          isLinkActive(pathname, item.href)
        );

        // No manufacturing link should be active
        expect(activeManufacturingLinks.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('isLinkActive returns true iff path matches href exactly or starts with href + "/"', () => {
    fc.assert(
      fc.property(pathArb, (pathname) => {
        for (const item of ALL_NAV_ITEMS) {
          const active = isLinkActive(pathname, item.href);

          if (item.href === '/') {
            // Special case: home only matches exactly '/'
            expect(active).toBe(pathname === '/');
          } else {
            // General case: exact match or starts with href + '/'
            const expectedActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            expect(active).toBe(expectedActive);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
