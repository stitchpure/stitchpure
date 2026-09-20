# Implementation Plan: Product Storefront

## Overview

Implement a public storefront page displaying products from all companies with Call/Send Query CTAs, a dashboard management page for toggling visibility and setting wholesale prices, the `storefront_listings` database table, public and authenticated API endpoints, search/filtering/pagination, and SSR for SEO. Built with Next.js App Router, Drizzle ORM, Zod validators, and TypeScript.

## Tasks

- [x] 1. Database schema, migration, and validators
  - [x] 1.1 Create the `storefront_listings` Drizzle schema and migration
    - Create `db/schema/storefront-listing.ts` with the `storefrontListings` table definition (uuid pk, product_id FK with cascade delete, numeric(12,2) wholesale_price, boolean is_visible default false, created_at, updated_at)
    - Add unique constraint on `product_id`
    - Export from `db/schema/index.ts`
    - Generate and verify the SQL migration file via `drizzle-kit generate`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 1.2 Create Zod validators for storefront operations
    - Create `validators/storefront.validator.ts` with `createStorefrontListingSchema`, `updateStorefrontListingSchema`, and `storefrontQuerySchema`
    - Wholesale price range: 0.01–9999999999.99
    - Pagination: page min 1, limit min 1 max 50 default 20
    - Search max 100 chars, categoryId as optional uuid
    - Export inferred types
    - _Requirements: 4.3, 6.5, 7.5, 8.1, 9.1_

  - [x] 1.3 Write property test for wholesale price validation
    - **Property 5: Wholesale Price Validation**
    - **Validates: Requirements 4.3, 5.3, 7.5**

  - [x] 1.4 Write property test for pagination parameter clamping
    - **Property 7: Pagination Parameter Clamping**
    - **Validates: Requirements 6.5, 9.1, 9.6**

- [x] 2. Service layer and utility functions
  - [x] 2.1 Create storefront service with core query functions
    - Create `services/storefront.service.ts`
    - Implement `getStorefrontProducts(params)` — joins storefront_listings → products → companies → categories, filters by isVisible=true, product.isActive=true, company.isActive=true, supports search (ILIKE on name), categoryId filter, pagination with LIMIT/OFFSET, ordered by createdAt DESC
    - Implement `getCompanyListings(companyId)` — returns all listings for a company
    - Implement `createListing(companyId, data)` — inserts listing with ownership check
    - Implement `updateListing(companyId, listingId, data)` — updates listing with ownership check
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7, 7.1, 7.2, 7.3, 7.4_

  - [x] 2.2 Create storefront formatting utilities
    - Create `lib/storefront-utils.ts`
    - Implement `truncateText(text, limit)` — returns original if ≤ limit, else limit chars + "…"
    - Implement `formatWholesalePrice(value)` — returns `₹{value.toFixed(2)} per piece`
    - Implement `generateCallHref(phone)` — returns `tel:{phone}`
    - Implement `generateQueryHref(email, productName)` — returns `mailto:{email}?subject=Wholesale%20Inquiry%3A%20{encoded productName}`
    - Implement `formatPageRange(page, limit, total)` — returns `Showing {start}–{end} of {total} products`
    - _Requirements: 2.1, 2.3, 2.6, 3.2, 3.3, 9.4_

  - [ ]* 2.3 Write property test for text truncation
    - **Property 2: Text Truncation**
    - **Validates: Requirements 2.1, 2.3**

  - [ ]* 2.4 Write property test for price formatting
    - **Property 3: Price Formatting**
    - **Validates: Requirements 2.6**

  - [ ]* 2.5 Write property test for CTA link generation
    - **Property 4: CTA Link Generation**
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 2.6 Write property test for page range display formatting
    - **Property 9: Page Range Display Formatting**
    - **Validates: Requirements 9.4**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Public storefront API endpoint
  - [ ] 4.1 Create the public GET `/api/storefront/products` route
    - Create `app/api/storefront/products/route.ts`
    - Parse and validate query params with `storefrontQuerySchema`
    - Call `getStorefrontProducts` from storefront service
    - Return JSON with `{ success: true, data, pagination: { page, limit, total, totalPages } }`
    - Return 400 for invalid params, 500 for server errors (no internal details)
    - No auth required
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 4.2 Write property test for visibility filtering
    - **Property 1: Visibility Filtering**
    - **Validates: Requirements 1.3, 1.4, 6.3**

  - [ ]* 4.3 Write property test for result ordering
    - **Property 6: Result Ordering**
    - **Validates: Requirements 6.1**

  - [ ]* 4.4 Write property test for combined search and category filter
    - **Property 8: Combined Search and Category Filter**
    - **Validates: Requirements 8.1, 8.5, 6.7**

- [ ] 5. Dashboard storefront management API endpoints
  - [ ] 5.1 Create authenticated GET/POST `/api/storefront/listings` route
    - Create `app/api/storefront/listings/route.ts`
    - GET: Authenticate user, get company from JWT, call `getCompanyListings(companyId)`, return listings
    - POST: Authenticate user, verify role is MANAGER or OWNER, validate body with `createStorefrontListingSchema`, verify product belongs to user's company (403 if not), call `createListing`, return 201 with listing
    - Handle duplicate (409), forbidden (403), validation error (422)
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

  - [ ] 5.2 Create authenticated PATCH `/api/storefront/listings/[id]` route
    - Create `app/api/storefront/listings/[id]/route.ts`
    - Authenticate user, verify role is MANAGER or OWNER
    - Validate body with `updateStorefrontListingSchema`
    - Verify listing belongs to user's company (403 if not)
    - Call `updateListing`, return updated listing
    - _Requirements: 7.3, 7.5, 7.6_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Public storefront page (SSR)
  - [ ] 7.1 Create the `(storefront)` route group layout
    - Create `app/(storefront)/layout.tsx` — minimal layout without sidebar/auth guard
    - Include basic HTML structure, no dashboard navigation
    - _Requirements: 1.1_

  - [ ] 7.2 Create the SSR storefront page with SEO metadata
    - Create `app/(storefront)/storefront/page.tsx` as a server component
    - Fetch initial products via `getStorefrontProducts` directly in the server component
    - Generate `metadata` export with title (≤60 chars), description (≤160 chars), Open Graph tags (og:title, og:description, og:image, og:url)
    - Handle empty state with default meta tags
    - Pass initial data to client components for interactivity
    - _Requirements: 1.1, 1.3, 1.6, 10.1, 10.2, 10.5_

  - [ ] 7.3 Create the `ProductGrid` and `ProductCard` components
    - Create `components/storefront/ProductGrid.tsx` — responsive grid layout (320px–1920px)
    - Create `components/storefront/ProductCard.tsx` — displays product name (truncated 60 chars), first image or placeholder, category, wholesale price formatted as `₹X.XX per piece`, company name, description (truncated 120 chars or hidden if null)
    - Product images: `loading="eager"` for first viewport, `loading="lazy"` below fold
    - Fallback placeholder on image error preserving dimensions
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.3, 10.4_

  - [ ] 7.4 Create `CallCTA` and `QueryCTA` components
    - Create `components/storefront/CallCTA.tsx` — `tel:` link, disabled state with tooltip when phone is null, accessible label
    - Create `components/storefront/QueryCTA.tsx` — `mailto:` link with pre-filled subject, accessible label
    - Both functional without login, keyboard navigable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 7.5 Create `StorefrontSearch`, `CategoryFilter`, and `StorefrontPagination` components
    - Create `components/storefront/StorefrontSearch.tsx` — debounced input (300ms), resets pagination on change
    - Create `components/storefront/CategoryFilter.tsx` — dropdown with "All Categories" default, resets pagination on change
    - Create `components/storefront/StorefrontPagination.tsx` — Previous/Next buttons, page numbers, disables at boundaries, shows "Showing X–Y of Z products"
    - Persist filter values as URL search params for shareability
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 7.6 Create `EmptyState` and loading indicator components
    - Create `components/storefront/EmptyState.tsx` — no products message, suggests adjusting filters
    - Create `components/storefront/LoadingGrid.tsx` — loading skeleton for product grid
    - _Requirements: 1.6, 1.7, 1.8, 8.6_

- [ ] 8. Dashboard storefront manager page
  - [ ] 8.1 Create the storefront manager page
    - Create `app/(dashboard)/storefront-manager/page.tsx` as a client component
    - Fetch company products with listing status via `GET /api/storefront/listings`
    - Display loading skeleton while fetching
    - Show list of all active company products with visibility status and wholesale price
    - _Requirements: 5.1, 5.6, 5.8_

  - [ ] 8.2 Create `ProductListingRow`, `VisibilityToggle`, and `WholesalePriceInput` components
    - Create `components/storefront/ProductListingRow.tsx` — row per product with toggle and price input
    - Create `components/storefront/VisibilityToggle.tsx` — on/off switch, disabled during API call
    - Create `components/storefront/WholesalePriceInput.tsx` — numeric input with inline validation (0.01–9999999.99)
    - Role-based rendering: MANAGER/OWNER get interactive controls, STAFF gets read-only view
    - Optimistic UI: disable control → API call → success toast / revert + error toast
    - Prevent toggle if wholesale price is empty or invalid
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7, 5.9_

- [ ] 9. Integration and wiring
  - [ ] 9.1 Add storefront manager link to sidebar navigation
    - Update `components/layout/Sidebar.tsx` to include a "Storefront" nav item linking to `/storefront-manager`
    - _Requirements: 5.1_

  - [ ] 9.2 Wire storefront page with client-side interactivity
    - Create a client wrapper component for the storefront page that handles search, filter, pagination state changes
    - Use URL search params as state source, fetch updated data from `/api/storefront/products` on param change
    - Show loading state during fetches, handle API errors gracefully
    - _Requirements: 1.7, 1.8, 8.8, 9.3, 9.5_

  - [ ]* 9.3 Write unit tests for storefront components and utilities
    - Test ProductCard rendering with various data (empty images, null description, long names)
    - Test CTA disabled state when phone is null
    - Test role-based rendering (MANAGER vs STAFF)
    - Test empty state rendering
    - Test debounce timing
    - Test meta tag generation
    - _Requirements: 2.1, 2.4, 3.4, 5.7, 1.6, 8.2, 10.2_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation uses TypeScript
- `fast-check` is already in devDependencies for property-based testing
- Existing schemas (products, companies, categories) are reused via Drizzle relations

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 2, "tasks": ["4.1", "5.1", "5.2"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "8.1"] },
    { "id": 5, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 6, "tasks": ["9.3"] }
  ]
}
```
