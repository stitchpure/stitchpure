# Design Document: Stock Management Frontend

## Overview

The Stock Management Frontend is a multi-tenant SaaS dashboard built entirely within the existing Next.js 16 (App Router) project. It provides authenticated business users with full CRUD management for products, categories, SKUs, purchases, sales, stock movements, users, and company settings.

The frontend uses no new npm packages. All UI is built with React 19 and Tailwind CSS v4. Authentication state lives in `localStorage` (JWT token). All API calls target same-origin `/api/**` endpoints — the backend that already exists in this project.

**Core design goals:**

- Zero new dependencies — use what's already installed
- Client-side route guarding with `localStorage` JWT
- Role-aware UI: OWNER / MANAGER / STAFF visibility tiers
- Consistent component primitives reused across all pages (Toast, Modal, ConfirmDialog, Skeleton, Pagination, StatusBadge)
- Indigo/blue primary palette, white card surfaces, gray sidebar

---

## Architecture

### Route Group Structure

Next.js App Router route groups separate public auth pages from the protected dashboard:

```
app/
├── layout.tsx                       ← root layout (fonts, global CSS)
├── page.tsx                         ← root page (redirects to /login or /dashboard)
├── (auth)/
│   ├── login/page.tsx               ← public login page
│   └── register/page.tsx            ← public register page
└── (dashboard)/
    ├── layout.tsx                   ← protected layout: Sidebar + Header + route guard
    ├── page.tsx                     ← dashboard home (stats)
    ├── categories/page.tsx
    ├── products/page.tsx
    ├── products/[id]/options/page.tsx
    ├── skus/page.tsx
    ├── purchases/page.tsx
    ├── purchases/[id]/page.tsx
    ├── sales/page.tsx
    ├── sales/[id]/page.tsx
    ├── stock-ledger/page.tsx
    ├── users/page.tsx
    └── company/page.tsx

```

Route groups `(auth)` and `(dashboard)` are purely for layout scoping — they do not appear in the URL.

### Authentication Flow

```
Browser                  localStorage           /api/**
  |                           |                    |
  |--- navigate to /dashboard |                    |
  |                           |                    |
  |   getToken() → null       |                    |
  |--- window.location = /login                    |
  |                                                |
  |--- submit login form ─────────────────────────►
  |                           |            POST /api/auth/login
  |                           |◄── { token, user, company }
  |   setToken(token)         |                    |
  |   window.location = /     |                    |
  |                           |                    |
  |--- navigate to /dashboard |                    |
  |   getToken() → "eyJ..." ──►                    |
  |   getUser() → { role }    |                    |
  |--- render dashboard       |                    |
```

### Data Flow per Page

Each dashboard page follows the same pattern:

1. Component mounts (`useEffect`)
2. Call `apiClient.get(endpoint)` — automatically attaches `Authorization: Bearer <token>`
3. Render skeleton while loading
4. On success: populate state, render table/list
5. On error: show inline error message with retry
6. Mutations (POST/PATCH/DELETE) trigger a success Toast and re-fetch the list

### 401 Handling

`lib/api-client.ts` intercepts every response. A 401 clears the token from `localStorage` and redirects to `/login` via `window.location.href`. This is the single source of truth for session expiry — no page needs to handle it individually.

---

## Components and Interfaces

### `lib/auth.ts` — JWT Helpers

```typescript
// Token storage
export function getToken(): string | null;
export function setToken(token: string): void;
export function removeToken(): void;

// Decode JWT payload without a library (atob on the middle segment)
export function getUser(): {
  userId: string;
  companyId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
} | null;

// Check expiry from exp claim in payload
export function isTokenValid(): boolean;
```

`getUser()` implementation: split the JWT on `.`, take index 1 (payload), pad to a multiple of 4, `atob()` it, `JSON.parse()` the result. If any step throws, return `null`.

### `lib/api-client.ts` — Fetch Wrapper

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

interface ApiError {
  success: false;
  message: string;
}

type ApiResult<T> = ApiResponse<T> | ApiError;

async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>>

// Convenience methods
export const apiClient = {
  get<T>(path: string): Promise<ApiResult<T>>,
  post<T>(path: string, body: unknown): Promise<ApiResult<T>>,
  patch<T>(path: string, body: unknown): Promise<ApiResult<T>>,
  delete<T>(path: string): Promise<ApiResult<T>>,
}
```

Internally, `apiRequest`:

1. Reads token from `localStorage` via `getToken()`
2. Adds `Authorization: Bearer <token>` header when token exists
3. Sets `Content-Type: application/json` for mutations
4. On 401 response: calls `removeToken()`, then `window.location.href = '/login'`
5. On non-2xx: returns `{ success: false, message: data.message || 'Request failed' }`
6. On 2xx: returns the parsed JSON as-is

### UI Primitive Components

#### `components/ui/Toast.tsx`

- Props: `{ message: string; type: 'success' | 'error'; onClose: () => void }`
- Auto-dismisses after 4 seconds
- Fixed position: bottom-right
- Green (success) / red (error) background with white text

#### `components/ui/ConfirmDialog.tsx`

- Props: `{ title: string; description: string; onConfirm: () => void; onCancel: () => void; isOpen: boolean }`
- Modal overlay with a semi-transparent backdrop
- Two buttons: "Cancel" (gray) and "Confirm" (red for destructive)

#### `components/ui/StatusBadge.tsx`

- Props: `{ status: string }`
- Maps status strings to color classes:
  - ACTIVE / RECEIVED / COMPLETED → green
  - PENDING → yellow
  - INACTIVE / CANCELLED / DISCONTINUED → red

#### `components/ui/Pagination.tsx`

- Props: `{ page: number; totalPages: number; onPageChange: (page: number) => void }`
- Renders Previous / page numbers / Next
- Disables Previous on page 1, Next on last page

#### `components/ui/Skeleton.tsx`

- Props: `{ className?: string }`
- Animated gray pulse block, composable for different shapes
- Used inside stat cards and table rows

#### `components/ui/Modal.tsx`

- Props: `{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }`
- Generic modal wrapper used by create/edit forms
- Backdrop click or Escape key closes

### Layout Components

#### `components/layout/Sidebar.tsx`

- Props: `{ role: 'OWNER' | 'MANAGER' | 'STAFF'; companyName: string; currentPath: string }`
- Renders nav links; conditionally renders "Users" and "Company" only for OWNER role
- Uses `usePathname()` to highlight the active link
- Width: 240px fixed, indigo-900 background, white text

#### `components/layout/Header.tsx`

- Props: `{ companyName: string; userName: string; onLogout: () => void }`
- Top bar with company name on the left, user name + logout button on the right
- White background, subtle border-bottom

### Dashboard Layout — `app/(dashboard)/layout.tsx`

This is a `'use client'` component. On mount:

1. Calls `isTokenValid()` — if false, removes token, redirects to `/login`
2. Calls `getUser()` to get role/name/companyId
3. Fetches company name from `/api/me` or decodes from localStorage context
4. Renders `<Sidebar>` + `<Header>` + `{children}` in a flex layout

The layout also provides a `ToastContext` so any child page can call `showToast(message, type)`.

---

## Data Models

### Frontend Types (TypeScript)

```typescript
// Auth
interface AuthUser {
  userId: string;
  companyId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
}

// API pagination envelope
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Category
interface Category {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product
interface Product {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  hsnCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product Option
interface ProductOption {
  id: string;
  productId: string;
  name: string;
  slug: string;
  type: "TEXT" | "COLOR" | "NUMBER";
  isRequired: boolean;
  isVariant: boolean;
  isActive: boolean;
  displayOrder: number;
}

// Product Option Value
interface OptionValue {
  id: string;
  optionId: string;
  value: string;
  code: string | null;
  colorCode: string | null;
  displayOrder: number;
  isActive: boolean;
}

// SKU / Product Item
interface ProductItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  weight: string | null;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  stockLevel: number;
  optionValues: Array<{
    optionId: string;
    optionName: string;
    optionSlug: string;
    optionValueId: string;
    value: string;
    code: string | null;
    colorCode: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Purchase
interface Purchase {
  id: string;
  companyId: string;
  supplierId: string | null;
  referenceNo: string;
  purchaseDate: string;
  totalAmount: string;
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseItem {
  id: string;
  productItemId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

// Sale
interface Sale {
  id: string;
  companyId: string;
  referenceNo: string;
  saleDate: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SaleItem {
  id: string;
  productItemId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

// Stock Ledger
interface LedgerEntry {
  id: string;
  companyId: string;
  productItemId: string;
  movementType: "PURCHASE" | "SALE" | "ADJUSTMENT";
  referenceType: string | null;
  referenceId: string | null;
  quantityChange: number;
  quantityAfter: number;
  notes: string | null;
  createdAt: string;
}

// User
interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

// Company
interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  logo: string | null;
  subscriptionPlan: string;
  isActive: boolean;
}
```

### State Shape per Page

Each list page manages local state:

```typescript
// Generic list page state pattern
{
  items: T[];
  pagination: PaginationMeta | null;
  loading: boolean;
  error: string | null;
  page: number;
  modalOpen: boolean;
  editTarget: T | null;      // null = create mode
  confirmTarget: T | null;   // item pending destructive action
}
```

---

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Error responses produce a structured error object

_For any_ non-2xx HTTP status code and any error message string returned by the API, the `apiClient` SHALL return an object with `success: false` and a `message` field equal to the API response's `message` field.

**Validates: Requirements 15.3**

---

### Property 2: 401 responses trigger logout and redirect

_For any_ API endpoint path, when the server responds with HTTP 401, the `apiClient` SHALL remove the JWT from `localStorage` and set `window.location.href` to `/login`.

**Validates: Requirements 15.2**

---

### Property 3: Authorization header attached for any token

_For any_ non-empty JWT string stored in `localStorage` and _any_ API path, the `apiClient` SHALL include an `Authorization: Bearer <token>` header in every outbound request.

**Validates: Requirements 15.1**

---

### Property 4: JWT decode round-trip preserves identity fields

_For any_ combination of `userId`, `companyId`, and `role` values encoded into a JWT payload (base64url middle segment), `getUser()` SHALL return an object where `userId`, `companyId`, and `role` exactly match the encoded values.

**Validates: Requirements 3.3**

---

### Property 5: Malformed JWT is rejected and cleared

_For any_ string that is not a valid three-segment base64url JWT (expired tokens, random strings, truncated tokens), `isTokenValid()` SHALL return `false`, and the route guard SHALL call `removeToken()` and redirect to `/login`.

**Validates: Requirements 3.4**

---

### Property 6: STAFF and MANAGER roles are hidden from owner-only nav links

_For any_ authenticated user whose role is STAFF or MANAGER, the Sidebar SHALL not render navigation links to "Users" or "Company Profile", regardless of any other state.

**Validates: Requirements 4.4, 18.2**

---

### Property 7: Active sidebar link matches current pathname

_For any_ valid dashboard route path, the Sidebar SHALL apply an active highlight style to exactly the navigation link whose `href` matches that path, and no other link.

**Validates: Requirements 4.2**

---

### Property 8: STAFF role hides all write action buttons

_For any_ management page (categories, products, SKUs, purchases, sales, users) and _any_ set of data items, when the authenticated user's role is STAFF, no create, edit, delete, or status-change action buttons SHALL be rendered.

**Validates: Requirements 18.1**

---

### Property 9: Confirmation dialog displays the record identifier

_For any_ record name or identifier string, when a destructive action is triggered for that record, the ConfirmDialog SHALL contain that name/identifier in its rendered text.

**Validates: Requirements 17.3**

---

### Property 10: Dismissing the ConfirmDialog makes no API call

_For any_ open ConfirmDialog, when the user clicks Cancel or dismisses the dialog, no HTTP request SHALL be made to any `/api/**` endpoint.

**Validates: Requirements 17.2**

---

### Property 11: Empty API response renders empty-state message

_For any_ list page, when the API returns an empty array, the page SHALL render a non-empty descriptive empty-state message (not a blank or loading state).

**Validates: Requirements 16.2**

---

### Property 12: Auth pages redirect authenticated users to dashboard

_For any_ valid JWT stored in `localStorage`, when a user navigates to `/login` or `/register`, the route guard SHALL redirect them to the dashboard home page without rendering the auth form.

**Validates: Requirements 1.5, 2.5**

---

### Property 13: Dashboard routes redirect unauthenticated users to login

_For any_ route path under the dashboard route group, when no valid JWT exists in `localStorage`, the route guard SHALL redirect the user to `/login` without rendering any dashboard content.

**Validates: Requirements 3.1**

---

### Property 14: API error message appears in Toast notification

_For any_ non-2xx API response with any `message` string, when a CRUD operation fails on any management page, the Toast notification SHALL display that exact message string.

**Validates: Requirements 6.6, 7.7, 8.8, 10.8, 11.7, 13.6, 14.5**

---

### Property 15: Sidebar displays authenticated user's name and role

_For any_ user name string and role value, when the Sidebar is rendered with that user context, it SHALL display both the name and the role in its output.

**Validates: Requirements 3.5**

---

## Error Handling

### API Error Taxonomy

| HTTP Status       | Handling Strategy                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| 400 Validation    | Extract `message` from response; show in Toast                                                      |
| 401 Unauthorized  | Clear token; redirect to `/login` (in `apiClient`)                                                  |
| 403 Forbidden     | Show error Toast: "You don't have permission to perform this action"                                |
| 404 Not Found     | Show error Toast: API message                                                                       |
| 409 Conflict      | Show error Toast: API message (e.g., duplicate SKU)                                                 |
| 422 Unprocessable | Show error Toast with full message (insufficient stock detail)                                      |
| 5xx Server Error  | Show error Toast: "Server error. Please try again."                                                 |
| Network failure   | Catch in `apiClient`; return `{ success: false, message: 'Network error. Check your connection.' }` |

### Form Validation

All forms perform client-side validation before submitting:

- Required fields checked before API call
- Email fields validated with basic regex
- Numeric fields (prices, quantities) validated as positive numbers
- Validation errors displayed inline below the respective field

### Loading States

Every async operation has three states managed in component state: `loading`, `data`, `error`. While `loading === true`, skeleton or spinner UIs are shown. This prevents blank flashes and provides clear user feedback.

---

## Testing Strategy

### Approach

This is a React/Next.js frontend with pure logic in `lib/auth.ts` and `lib/api-client.ts` and rendering logic in components. The testing strategy uses two complementary layers:

1. **Unit/Property tests** — Test pure logic functions and component rendering behavior using a test framework
2. **Example-based tests** — Test specific UI states (loading, empty, error, role-based rendering)

### Test Framework

Since no new packages can be added, and the project doesn't currently have a test runner configured, the property tests are specified here as executable specifications. When a test runner is added (the standard choice for Next.js is **Vitest** with **@testing-library/react**), these properties map directly to test implementations.

> Note: If the constraint against new packages is relaxed for dev dependencies, `vitest` + `@testing-library/react` + `fast-check` (for property-based testing) would be the recommended test stack. These are dev-only dependencies and don't affect the production bundle.

### Property-Based Test Specifications

Each correctness property maps to a property-based test using `fast-check` generators:

**Property 1 & 3 — apiClient behavior:**

```
fc.property(
  fc.string({ minLength: 1 }),           // token
  fc.constantFrom(400, 403, 404, 409, 422, 500),  // status
  fc.string({ minLength: 1 }),           // error message
  async (token, status, message) => { ... }
)
// Min 100 runs
```

**Property 4 — JWT decode:**

```
fc.property(
  fc.uuid(),              // userId
  fc.uuid(),              // companyId
  fc.constantFrom('OWNER', 'MANAGER', 'STAFF'),  // role
  (userId, companyId, role) => { ... }
)
```

**Property 5 — Malformed JWT:**

```
fc.property(
  fc.oneof(
    fc.string(),                                   // random string
    fc.string().map(s => s.split('.')[0] || s),    // truncated
  ),
  (badToken) => { ... }
)
```

**Property 6, 7, 8 — Role/sidebar rendering:**

```
fc.property(
  fc.constantFrom('STAFF', 'MANAGER'),
  (role) => { ... } // render Sidebar, assert no owner-only links
)
```

### Unit Test Focus Areas

- `lib/auth.ts`: `getUser()`, `isTokenValid()`, `setToken()`, `removeToken()` — pure functions, fully unit-testable
- `lib/api-client.ts`: All methods with mocked `fetch` — verify headers, error handling, 401 redirect
- `components/ui/StatusBadge.tsx`: Snapshot test for each status value
- `components/ui/ConfirmDialog.tsx`: Render test for open/closed states, confirm/cancel callbacks
- `components/ui/Pagination.tsx`: Boundary cases (page 1, last page, many pages)
- `components/layout/Sidebar.tsx`: Role-based link visibility for all three roles
- `components/layout/Header.tsx`: Company name and logout button rendering

### Integration Test Focus Areas (Manual or E2E)

- Full login → dashboard → logout flow
- Create category → see it in table → delete it
- Create purchase (PENDING) → Mark as Received → verify stock ledger entry
- Create sale with insufficient stock → verify 422 error Toast
- STAFF user cannot see write buttons on any page
- Expired token on page navigation → redirect to login
