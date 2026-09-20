# Implementation Plan: Stock Management Frontend

## Overview

Build the complete frontend for the stock management SaaS dashboard inside the existing Next.js 16 (App Router) project. All implementation uses React 19, Tailwind CSS v4, and TypeScript — no new npm packages. Pages are organized under `app/(auth)/*` and `app/(dashboard)/*`, shared components under `components/`.

The implementation follows a bottom-up approach: shared lib utilities and UI primitives first, then layout, then feature pages.

---

## Tasks

- [x] 1. Create shared library utilities (`lib/auth.ts` and `lib/api-client.ts`)
  - [x] 1.1 Implement `lib/auth.ts` — JWT helpers
    - Create `lib/auth.ts` with `getToken`, `setToken`, `removeToken`, `getUser`, and `isTokenValid` exports
    - `getUser()` must decode the JWT middle segment using `atob` and `JSON.parse` without any library; return `null` on any error
    - `isTokenValid()` must check the `exp` claim against `Date.now()`; return `false` for malformed tokens
    - _Requirements: 3.3, 3.4, 15.1_

  - [x] 1.2 Write property tests for `lib/auth.ts`
    - **Property 4: JWT decode round-trip preserves identity fields** — generate arbitrary `userId` (uuid), `companyId` (uuid), `role` (OWNER/MANAGER/STAFF), encode as base64url JWT payload, assert `getUser()` returns identical values
    - **Property 5: Malformed JWT is rejected and cleared** — generate random strings, truncated tokens, expired tokens; assert `isTokenValid()` returns `false`
    - **Validates: Requirements 3.3, 3.4**

  - [x] 1.3 Implement `lib/api-client.ts` — fetch wrapper
    - Create `lib/api-client.ts` exporting `apiClient` with `get`, `post`, `patch`, `delete` convenience methods
    - Every request must attach `Authorization: Bearer <token>` when a token exists in `localStorage`
    - On 401 response: call `removeToken()` then set `window.location.href = '/login'`
    - On non-2xx: return `{ success: false, message: data.message || 'Request failed' }`
    - On network failure: catch and return `{ success: false, message: 'Network error. Check your connection.' }`
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 1.4 Write property tests for `lib/api-client.ts`
    - **Property 1: Error responses produce a structured error object** — mock fetch returning any non-2xx status with any message string; assert return shape is `{ success: false, message: <api message> }`
    - **Property 2: 401 responses trigger logout and redirect** — mock fetch returning 401 for any path; assert `removeToken()` called and `window.location.href === '/login'`
    - **Property 3: Authorization header attached for any token** — set any non-empty token in localStorage, call any apiClient method, assert `Authorization: Bearer <token>` header present
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 2. Build UI primitive components
  - [x] 2.1 Create `components/ui/Skeleton.tsx`
    - Animated gray pulse block; accepts `className` prop for shape composability
    - _Requirements: 5.5, 16.1_

  - [x] 2.2 Create `components/ui/StatusBadge.tsx`
    - Map status strings to Tailwind color classes: ACTIVE/RECEIVED/COMPLETED → green, PENDING → yellow, INACTIVE/CANCELLED/DISCONTINUED → red
    - _Requirements: 6.7, 9.9, 10.9, 11.9, 13.7_

  - [x] 2.3 Create `components/ui/Toast.tsx` and `components/ui/ToastContext.tsx`
    - Toast: fixed bottom-right, green/red background, auto-dismisses after 4 s, `onClose` prop
    - ToastContext: `showToast(message, type)` context provider wrapping the dashboard layout
    - _Requirements: 1.3, 6.5, 6.6, 7.6, 7.7_

  - [x] 2.4 Create `components/ui/ConfirmDialog.tsx`
    - Modal overlay with semi-transparent backdrop; props: `isOpen`, `title`, `description`, `onConfirm`, `onCancel`
    - Must display the record name/identifier passed via `description`
    - Two buttons: "Cancel" (gray) and "Confirm" (red)
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ]* 2.5 Write property tests for `components/ui/ConfirmDialog.tsx`
    - **Property 9: Confirmation dialog displays the record identifier** — render ConfirmDialog with arbitrary `description` strings; assert description text appears in rendered output
    - **Property 10: Dismissing the ConfirmDialog makes no API call** — render open ConfirmDialog, click Cancel, assert no fetch call was made
    - **Validates: Requirements 17.2, 17.3**

  - [x] 2.6 Create `components/ui/Modal.tsx`
    - Generic modal wrapper: `isOpen`, `onClose`, `title`, `children` props
    - Close on backdrop click or Escape key
    - _Requirements: 6.2, 6.3, 7.2, 7.3_

  - [x] 2.7 Create `components/ui/Pagination.tsx`
    - Renders Previous / page numbers / Next; disables Previous on page 1, Next on last page
    - Props: `page`, `totalPages`, `onPageChange`
    - _Requirements: 6.8, 7.8, 9.10, 10.10, 12.5, 13.8_

- [x] 3. Checkpoint — Ensure all lib and UI primitive tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build layout components and dashboard shell
  - [-] 4.1 Create `components/layout/Sidebar.tsx`
    - Props: `role`, `companyName`, `currentPath`
    - Render nav links to Home, Categories, Products, SKUs, Purchases, Sales, Stock Ledger; render "Users" and "Company" links only when `role === 'OWNER'`
    - Use `usePathname()` to highlight the active link
    - Indigo-900 background, 240px fixed width, white text
    - _Requirements: 4.1, 4.2, 4.4, 18.2_

  - [ ]* 4.2 Write property tests for `components/layout/Sidebar.tsx`
    - **Property 6: STAFF and MANAGER roles are hidden from owner-only nav links** — render Sidebar with role STAFF or MANAGER (arbitrary from those two); assert no "Users" or "Company" link rendered
    - **Property 7: Active sidebar link matches current pathname** — render Sidebar with any valid dashboard route; assert exactly one link has the active highlight class and its href matches the path
    - **Property 15: Sidebar displays authenticated user's name and role** — render with any user name string and role; assert both appear in output
    - **Validates: Requirements 4.2, 4.4, 3.5, 18.2**

  - [x] 4.3 Create `components/layout/Header.tsx`
    - Props: `companyName`, `userName`, `onLogout`
    - White top bar with company name left, user name + logout button right
    - _Requirements: 4.5, 3.5_

  - [x] 4.4 Create `app/(dashboard)/layout.tsx` — protected dashboard shell
    - `'use client'` component; on mount call `isTokenValid()` — if false remove token and redirect to `/login`
    - Call `getUser()` to get role/companyId; render `<Sidebar>` + `<Header>` + `{children}` in a flex layout
    - Wrap children in `ToastContext` provider
    - Responsive at 768px and above
    - _Requirements: 3.1, 3.2, 3.4, 4.3, 4.5, 4.6_

  - [ ]* 4.5 Write property tests for route guard behavior
    - **Property 13: Dashboard routes redirect unauthenticated users to login** — render dashboard layout with no token in localStorage; assert redirect to `/login`
    - **Property 12: Auth pages redirect authenticated users to dashboard** — render login/register page with valid token in localStorage; assert redirect to dashboard
    - **Validates: Requirements 3.1, 1.5, 2.5**

  - [x] 4.6 Create `app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx`
    - Login: email + password fields, submit button, centered card layout, no sidebar
    - Register: company name, slug, email, phone, owner name, owner email, owner password fields, centered card layout
    - Both: route guard redirects already-authenticated users to dashboard; show loading indicator + disable submit while request in flight; show error Toast on non-2xx
    - Store returned JWT via `setToken()`, redirect to `/` on success
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.7 Update `app/page.tsx` — root redirect
    - Replace the placeholder page with a client-side redirect: if valid token → `/dashboard` (or `/(dashboard)` root), else → `/login`
    - _Requirements: 3.1_

- [x] 5. Checkpoint — Ensure auth flow and layout render correctly with tests passing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Categories, Products, and Product Options pages
  - [x] 6.1 Create `app/(dashboard)/categories/page.tsx`
    - Fetch paginated categories from `/api/categories`; render table with name, parent category, status columns
    - MANAGER/OWNER: "Create Category" button opens Modal with form (name, parentId dropdown, description); submits POST
    - MANAGER/OWNER: "Edit" per row opens pre-populated Modal; submits PATCH
    - MANAGER/OWNER: "Delete" per row shows ConfirmDialog; submits DELETE
    - StatusBadge for active/inactive, Pagination, empty-state message, skeleton loading, error state with retry
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 16.1, 16.2, 16.3_

  - [ ]* 6.2 Write property tests for Categories role-based rendering
    - **Property 8: STAFF role hides all write action buttons** — render Categories page with role STAFF and any non-empty item list; assert no Create, Edit, Delete buttons are rendered
    - **Property 11: Empty API response renders empty-state message** — mock `/api/categories` returning empty array; assert non-empty descriptive message rendered (no blank or loading state)
    - **Property 14: API error message appears in Toast notification** — mock any category mutation returning non-2xx with a message; assert Toast displays that exact message
    - **Validates: Requirements 6.6, 16.2, 18.1**

  - [x] 6.3 Create `app/(dashboard)/products/page.tsx`
    - Fetch paginated products from `/api/products`; render table with name, category, HSN code, status columns
    - MANAGER/OWNER: Create/Edit/Delete actions via Modal and ConfirmDialog
    - Link per row to `/products/[id]/options`
    - StatusBadge (active/inactive), Pagination, empty-state, skeleton, error with retry
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 16.1, 16.2_

  - [x] 6.4 Create `app/(dashboard)/products/[id]/options/page.tsx` — Product Options and Values
    - Fetch and display all options for the product from `/api/products/[id]/options`
    - MANAGER/OWNER: "Add Option" form (name, type, isRequired, isVariant, displayOrder); submits POST
    - MANAGER/OWNER: Edit and Delete per option with ConfirmDialog for delete
    - Expandable per-option section: fetch values from `/api/products/[id]/options/[optionId]/values`; "Add Value", "Edit Value", "Delete Value" actions
    - Success Toast + refresh on every operation; error Toast on failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 7. Implement SKUs page
  - [x] 7.1 Create `app/(dashboard)/skus/page.tsx`
    - Fetch paginated SKUs from `/api/product-items`; render table with SKU code, product name, status, selling price, stock level columns
    - Filter controls for `productId`, `status`, and search keyword (debounced or on-submit)
    - MANAGER/OWNER: "Create SKU" button opens Modal with form (productId, sku, barcode, purchasePrice, sellingPrice, mrp, weight, status, optionValues[]); submits POST
    - MANAGER/OWNER: "Edit" per row opens pre-populated form; submits PATCH
    - MANAGER/OWNER: "Discontinue" per row shows ConfirmDialog; submits DELETE
    - "View Ledger" link per row to `/stock-ledger?productItemId=[id]`
    - StatusBadge, Pagination, empty-state, skeleton, error with retry
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 16.1, 16.2_

- [x] 8. Implement Purchases and Sales pages
  - [x] 8.1 Create `app/(dashboard)/purchases/page.tsx`
    - Fetch paginated purchases from `/api/purchases`; render table with reference number, date, total amount, status
    - MANAGER/OWNER: "Create Purchase" button opens Modal with form (supplierId, referenceNo, purchaseDate, status, notes, line items[]); submits POST
    - Row click navigates to `/purchases/[id]`
    - StatusBadge, Pagination, empty-state, skeleton, error with retry
    - _Requirements: 10.1, 10.2, 10.3, 10.9, 10.10, 16.1, 16.2_

  - [x] 8.2 Create `app/(dashboard)/purchases/[id]/page.tsx` — Purchase Detail
    - Fetch purchase detail from `/api/purchases/[id]`; display all line items
    - MANAGER/OWNER + PENDING status: "Mark as Received" button → PATCH `status: "RECEIVED"`
    - MANAGER/OWNER + PENDING status: "Cancel" shows ConfirmDialog → PATCH `status: "CANCELLED"`
    - MANAGER/OWNER + PENDING status: "Delete" shows ConfirmDialog → DELETE
    - Success Toast + refresh on status update; error Toast on failure
    - StatusBadge for purchase status
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 8.3 Create `app/(dashboard)/sales/page.tsx`
    - Fetch paginated sales from `/api/sales`; render table with reference number, customer name, date, total amount, status
    - MANAGER/OWNER: "Create Sale" button opens Modal with form (referenceNo, saleDate, customerName, customerPhone, status, notes, line items[]); submits POST
    - Row click navigates to `/sales/[id]`
    - On 422 error when creating a COMPLETED sale: show descriptive Toast with insufficient stock message
    - StatusBadge, Pagination, empty-state, skeleton, error with retry
    - _Requirements: 11.1, 11.2, 11.7, 11.9, 11.10, 16.1, 16.2_

  - [x] 8.4 Create `app/(dashboard)/sales/[id]/page.tsx` — Sale Detail
    - Fetch sale detail from `/api/sales/[id]`; display all line items
    - MANAGER/OWNER + PENDING status: "Mark as Completed" → PATCH `status: "COMPLETED"`
    - MANAGER/OWNER + PENDING status: "Cancel" shows ConfirmDialog → PATCH `status: "CANCELLED"`
    - MANAGER/OWNER + PENDING status: "Delete" shows ConfirmDialog → DELETE
    - On 422 when completing: show descriptive error Toast with the insufficient stock message
    - Success Toast + refresh; error Toast on failure
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [x] 9. Checkpoint — Ensure Categories, Products, SKUs, Purchases, and Sales pages are complete with tests passing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Stock Ledger, Users, and Company pages
  - [x] 10.1 Create `app/(dashboard)/stock-ledger/page.tsx`
    - If `productItemId` query param present: fetch and display paginated ledger from `/api/stock-ledger?productItemId=[id]`
    - If absent: render SKU search/selection input; once a SKU is selected fetch ledger data
    - Display columns: movement type, quantity change, quantity after, reference type, timestamp
    - Color-coded StatusBadge/indicator: PURCHASE → green, SALE → red, ADJUSTMENT → gray
    - Pagination, loading indicator, skeleton while fetching
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 16.1_

  - [x] 10.2 Create `app/(dashboard)/users/page.tsx`
    - Role guard: redirect non-OWNER users to dashboard home on mount
    - Fetch paginated users from `/api/users`; render table with name, email, role, active status, last login
    - OWNER: "Create User" Modal with name, email, password, role fields; submits POST
    - OWNER: "Edit" per row with name/role fields; submits PATCH
    - OWNER: "Deactivate" per row (not current user) shows ConfirmDialog; submits DELETE
    - StatusBadge for active/inactive, Pagination, empty-state, success/error Toasts
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [x] 10.3 Create `app/(dashboard)/company/page.tsx`
    - Role guard: redirect non-OWNER users to dashboard home on mount
    - Fetch company from `/api/companies/[companyId]`; display name, slug (read-only), email, phone, logo URL, subscriptionPlan (read-only)
    - OWNER: inline edit form for name, email, phone, logo; submits PATCH
    - Success Toast on update; error Toast on failure; refresh displayed data after update
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 10.4 Create `app/(dashboard)/page.tsx` — Dashboard Home (stats)
    - In parallel, fetch `/api/products`, `/api/product-items`, `/api/purchases`, `/api/sales` (page=1, limit=1) to get `pagination.total`
    - Render four stat cards: Total Products, Total SKUs, Total Purchases, Total Sales
    - Skeleton placeholders while loading; inline error message per stat card if individual fetch fails
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 11. Final checkpoint — Ensure all tests pass and the complete dashboard is wired together
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- The design document specifies no test runner is currently configured; if the no-new-packages constraint is relaxed for dev dependencies, add `vitest` + `@testing-library/react` + `fast-check` before running `*` tasks
- All `*` property tests reference their Property number from `design.md` for full traceability
- Checkpoints ensure incremental validation before proceeding to dependent pages
- Every page should be a `'use client'` component; data fetching is done client-side via `useEffect` + `apiClient`
- The `ToastContext` from task 2.3 must be wired in `app/(dashboard)/layout.tsx` (task 4.4) before any page can call `showToast`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.3", "2.4", "2.6", "2.7"] },
    { "id": 2, "tasks": ["1.4", "2.5", "4.1", "4.3"] },
    { "id": 3, "tasks": ["4.2", "4.4"] },
    { "id": 4, "tasks": ["4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["6.1", "6.3", "7.1", "8.1", "8.3", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 6, "tasks": ["6.2", "6.4", "8.2", "8.4"] }
  ]
}
```
