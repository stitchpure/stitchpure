# Implementation Plan: Manufacturing Cost Frontend

## Overview

This plan implements the Manufacturing Cost Management frontend pages — Production Batches (list + detail), Expenses (list with CRUD modals), and Product Cost Sheets (list + detail) — integrated into the existing Next.js 16 App Router dashboard. The implementation follows established patterns: client components with `useState`/`useEffect`, `apiClient` for HTTP, shared UI components (Modal, ConfirmDialog, Toast, StatusBadge, Pagination, Skeleton), and role-based write guards.

## Tasks

- [x] 1. Set up shared types, utilities, and sidebar navigation
  - [x] 1.1 Create TypeScript type definitions for production batches, expenses, and cost sheets
    - Create `types/production-batch.ts` with `ProductionBatch` interface and `BatchStatus` type
    - Create `types/expense.ts` with `Expense` interface, `ExpenseCategory` type
    - Create `types/product-cost-sheet.ts` with `ProductCostSheet` interface, `CostSheetStatus` type
    - Create `types/pagination.ts` with shared `PaginationMeta` interface (if not already shared)
    - _Requirements: 2.1, 2.2, 7.1, 9.1, 9.3_

  - [x] 1.2 Create form validation utility module
    - Create `lib/form-validation.ts` with `validateRequired`, `validateNumericRange`, `validateQuantityMatch` functions
    - Export `ValidationError` interface and `validateForm` helper for running multiple validators
    - Include `clearFieldError` utility for removing errors for corrected fields
    - _Requirements: 3.9, 5.3, 8.13, 10.4, 12.1, 12.2, 12.6_

  - [x] 1.3 Modify Sidebar to add Manufacturing section
    - Refactor `components/layout/Sidebar.tsx` to support `NavSection[]` structure with optional section labels
    - Add "Manufacturing" section header positioned after "Stock Ledger" and before owner-only links
    - Add three navigation links: "Production Batches" (`/production-batches`), "Expenses" (`/expenses`), "Cost Sheets" (`/cost-sheets`)
    - Maintain existing active-link logic (exact match or starts-with for sub-paths)
    - Ensure section is visible to all authenticated roles (OWNER, MANAGER, STAFF)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement Production Batches list page
  - [x] 2.1 Create Production Batches list page with paginated table
    - Create `app/(dashboard)/production-batches/page.tsx` as a client component
    - Fetch batches from `GET /api/production-batches?page=N&limit=20` using `apiClient`
    - Display table with columns: batch number, product name, status, planned quantity, good quantity, start date
    - Render `StatusBadge` per batch status (DRAFT=gray, IN_PROGRESS=yellow, COMPLETED=green, CANCELLED=red)
    - Implement row click navigation to `/production-batches/[id]`
    - Add skeleton loading state, empty state, and error state with retry button
    - Add `Pagination` control when total exceeds page size
    - Add `aria-busy` on table container during loading, `aria-live="polite"` region
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 13.1, 13.3_

  - [x] 2.2 Add Create Batch modal to Production Batches page
    - Render "Create Batch" button only for MANAGER/OWNER roles (role guard)
    - Implement modal form with: product selection dropdown, SKU dropdown (cascading from product), planned quantity (integer, min 1, max 999999), start date
    - Fetch products from `GET /api/products` for product dropdown
    - On product selection, fetch SKUs from `GET /api/products/[id]/items`; disable SKU dropdown with "No SKUs available" if none returned
    - Client-side validation: required fields check, numeric range for planned quantity
    - Submit via `POST /api/production-batches`; success → toast + close + refresh; error → toast + modal stays open with data preserved
    - Disable submit button and show "Creating..." while in flight
    - Ensure form labels use `htmlFor`/`id` associations, `aria-required="true"` on required fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 12.1, 13.2, 13.3, 13.5_

- [x] 3. Implement Production Batches detail page
  - [x] 3.1 Create Batch Detail page with status transitions
    - Create `app/(dashboard)/production-batches/[id]/page.tsx` as a client component
    - Fetch batch from `GET /api/production-batches/[id]` and display all detail fields
    - Render `StatusBadge` for current status
    - Show "Start Production" button (DRAFT→IN_PROGRESS) for MANAGER/OWNER
    - Show "Complete Batch" button (IN_PROGRESS→COMPLETED) for MANAGER/OWNER
    - Show "Cancel Batch" button with ConfirmDialog (IN_PROGRESS→CANCELLED) for MANAGER/OWNER
    - Handle status transition responses: success → toast + refresh; 422 → error toast; 409 → error toast; other → error toast
    - Disable all action buttons and show spinner while transition is in flight
    - Hide all action buttons for STAFF role
    - Add loading skeleton, error state with retry, back navigation link
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 13.1, 13.3_

  - [x] 3.2 Add Cost Breakdown section to Batch Detail page
    - Render cost breakdown only when batch status is COMPLETED
    - Display: material cost, labour cost, overhead cost, packaging cost, transport cost, other cost, total manufacturing cost, cost per unit (all formatted to 2 decimal places)
    - Hide cost breakdown for non-COMPLETED batches
    - _Requirements: 4.13, 4.14_

  - [x] 3.3 Add Edit and Delete functionality to Batch Detail page
    - Show "Edit" button for DRAFT/IN_PROGRESS batches when role is MANAGER/OWNER
    - Edit modal with fields: planned quantity, produced quantity, good quantity, rejected quantity, notes
    - Client-side validation: quantity mismatch check (produced ≠ good + rejected), numeric ranges
    - Submit via `PATCH /api/production-batches/[id]` with changed fields only; success → toast + refresh; error → toast
    - Show "Delete" button for DRAFT batches when role is MANAGER/OWNER
    - Delete with ConfirmDialog showing batch number; submit via `DELETE /api/production-batches/[id]`
    - On delete success → toast + navigate to list; on 409 → error toast; on other error → error toast
    - Hide Edit/Delete for COMPLETED/CANCELLED batches and for STAFF role
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12_

  - [x] 3.4 Add Batch Expenses section to Batch Detail page
    - Fetch linked expenses from `GET /api/production-batches/[id]/expenses?page=N&limit=20`
    - Display table: name, category, amount (2dp), date, includeInManufacturingCost status
    - Skeleton loading, empty state ("No expenses linked"), pagination when > 20 items
    - Error state with retry button for the expenses section
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4. Checkpoint - Ensure all production batch pages work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Expenses list page with CRUD
  - [x] 5.1 Create Expenses list page with filters and pagination
    - Create `app/(dashboard)/expenses/page.tsx` as a client component
    - Fetch expenses from `GET /api/expenses?page=N&limit=20` with optional `productionBatchId` and `category` query params
    - Display table: name, category, amount (2dp), expense date, linked batch number (or dash), includeInManufacturingCost
    - Implement batch filter dropdown (populated from `GET /api/production-batches`) and category filter dropdown (MATERIAL, LABOUR, PACKAGING, OVERHEAD, TRANSPORT, OTHER)
    - Filters reset pagination to page 1 when changed
    - Skeleton loading, empty state, error state with retry, pagination
    - Add `aria-busy`, `aria-live="polite"` for accessibility
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 13.1, 13.3_

  - [x] 5.2 Add Create, Edit, and Delete expense functionality
    - Render "Create Expense" button for MANAGER/OWNER
    - Create modal form: name (1–255 chars), amount (0.01–99999999999999.99), category (select), expense date, production batch (optional select), notes (optional, max 2000 chars), includeInManufacturingCost (checkbox, default true)
    - Client-side validation for all required fields and numeric ranges
    - Submit via `POST /api/expenses`; handle 409 (duplicate) and 400 (validation) with toast + modal stays open
    - Per-row "Edit" action for MANAGER/OWNER opening pre-populated modal; submit via `PATCH /api/expenses/[id]`
    - Per-row "Delete" action for MANAGER/OWNER with ConfirmDialog; submit via `DELETE /api/expenses/[id]`
    - Disable submit button during flight, show loading indicator
    - Hide all write actions for STAFF role
    - Inline validation errors below invalid fields; form data preserved on API errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 12.1, 12.2, 12.7, 13.2, 13.5_

- [x] 6. Implement Product Cost Sheets pages
  - [x] 6.1 Create Cost Sheets list page with filter and create modal
    - Create `app/(dashboard)/cost-sheets/page.tsx` as a client component
    - Fetch cost sheets from `GET /api/product-cost-sheets?page=N&limit=20` with optional `productId` filter
    - Display table: product name, SKU code (or dash), total manufacturing cost per unit, status, effective date (ordered by effective date desc)
    - Render `StatusBadge` for each status (DRAFT, ACTIVE, ARCHIVED)
    - Implement product filter dropdown; reset pagination on filter change
    - Row click navigates to `/cost-sheets/[id]`
    - Skeleton loading, empty state, error state with retry, pagination
    - Render "Create Cost Sheet" button for MANAGER/OWNER
    - Create modal: batch selection dropdown (COMPLETED batches only, showing batch number + product name) and effective date
    - Fetch completed batches for dropdown; show empty state + disable submit if none
    - Client-side validation for required fields
    - Submit via `POST /api/product-cost-sheets`; handle 422, other errors with toast + modal stays open
    - Disable submit during flight
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 13.1, 13.3_

  - [x] 6.2 Create Cost Sheet Detail page with status management
    - Create `app/(dashboard)/cost-sheets/[id]/page.tsx` as a client component
    - Fetch cost sheet from `GET /api/product-cost-sheets/[id]`
    - Display: product name, SKU (if applicable), effective date, status badge
    - Display per-unit cost breakdown table: material, labour, overhead, packaging, transport, other, total — all to 4 decimal places
    - Display linked batch number as hyperlink to `/production-batches/[batchId]`
    - Show "Activate" button (DRAFT→ACTIVE) for MANAGER/OWNER
    - Show "Archive" button with ConfirmDialog (ACTIVE→ARCHIVED) for MANAGER/OWNER
    - Handle status change: success → toast + refresh; error → error toast
    - Disable action buttons during flight
    - Hide action buttons for ARCHIVED status and STAFF role
    - Loading skeleton, error state with retry, back navigation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 13.1, 13.3_

- [x] 7. Checkpoint - Ensure all pages are functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Property-based tests for correctness properties
  - [x]* 8.1 Write property test for active link path matching
    - **Property 1: Active Link Path Matching**
    - Generate random URL paths (valid manufacturing routes, sub-routes, unrelated paths)
    - Verify exactly one manufacturing link is marked active when path matches, zero when no match
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 1.3, 1.5**

  - [x]* 8.2 Write property test for required field validation
    - **Property 2: Required Field Validation Prevents Submission**
    - Generate random form states with 0+ empty required fields for batch, expense, and cost sheet forms
    - Verify each empty required field gets an error; non-empty fields don't; overall result blocks submission
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 3.9, 8.13, 10.4, 12.1**

  - [x]* 8.3 Write property test for quantity cross-field constraint
    - **Property 3: Quantity Cross-Field Constraint**
    - Generate random integer triples (produced, good, rejected)
    - Verify error produced iff `produced ≠ good + rejected`; no error when they match
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 5.3**

  - [x]* 8.4 Write property test for numeric formatting precision
    - **Property 4: Numeric Formatting Precision**
    - Generate random valid numeric strings and precisions (2 or 4)
    - Verify formatted output has exactly the specified decimal places
    - Verify round-trip parsing is within epsilon (±0.005 for 2dp, ±0.00005 for 4dp)
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 6.2, 11.1**

  - [x]* 8.5 Write property test for numeric range validation
    - **Property 5: Numeric Range Validation**
    - Generate random values (strings, negatives, very large numbers, valid numbers) with min/max bounds
    - Verify error iff value is non-numeric, < min, or > max; no error when valid
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 12.2**

  - [x]* 8.6 Write property test for validation error clearing
    - **Property 6: Validation Error Clearing on Correction**
    - Generate random multi-field error states, then correct one field
    - Verify only the corrected field's error is removed; other errors remain
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 12.6**

  - [x]* 8.7 Write property test for form label-input association
    - **Property 7: Form Label-Input Association**
    - Render each manufacturing form and enumerate all inputs with `id` attributes
    - Verify each has a corresponding `<label>` with matching `htmlFor`
    - Use `fast-check` or deterministic DOM assertions (minimum 100 iterations if property-based)
    - **Validates: Requirements 13.5**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All pages follow the existing client component pattern with `useState`/`useEffect` for data fetching
- The `apiClient` module handles authentication, error responses, and 401 redirect automatically
- `StatusBadge`, `Modal`, `ConfirmDialog`, `Pagination`, `Skeleton`, and `Toast` are all existing shared components

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["2.2", "5.2", "6.2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] }
  ]
}
```
