# Design Document — Stock Management Backend Completion

## Overview

This document describes the technical design for completing the backend of the multi-tenant stock management / e-commerce SaaS application. The system is built with Next.js 16 App Router, Drizzle ORM, PostgreSQL, JWT authentication, Zod validation, and bcrypt.

### Scope

The existing system has auth (register/login), categories CRUD, and product item create/read. This design covers:

- Products CRUD (create, read, update, soft-delete)
- Product Options CRUD (options and option values per product)
- Product Item update and delete (completing the CRUD)
- Company profile management
- User management (team access control)
- Purchases (stock intake) with ledger integration
- Sales (stock outflow) with stock-level enforcement
- Stock ledger tracking (append-only movement log)
- Role-Based Access Control (RBAC)
- Offset-based pagination utility
- DB migrations for all new tables
- Bug fixes: categories active filter + product_options slug migration

### Architecture Philosophy

All new features follow the existing, established pattern:

```
API Route → authMiddleware → requireRole guard → Service → Drizzle ORM → PostgreSQL
```

No new frameworks or libraries are introduced. Zod validators remain co-located with their schemas in `validators/`. Services encapsulate all database logic and throw typed errors with HTTP status codes. API routes handle error mapping and JSON response formatting.

---

## Architecture

### Request Flow

```
Client HTTP Request
        │
        ▼
Next.js App Router (app/api/**/route.ts)
        │
        ▼
authMiddleware(request) → AuthUser { userId, companyId, role }
        │
        ▼
requireRole(user, ...allowedRoles)  ← new: middleware/role.ts
        │
        ▼
Zod validator.parse(body)
        │
        ▼
Service function (services/*.service.ts)
        │
        ├── db.transaction(tx => ...) for write operations
        │
        ▼
Drizzle ORM queries → PostgreSQL
        │
        ▼
JSON Response { success, message, data, [pagination] }
```

### Multi-Tenancy Boundary

Every query that reads or writes data **must** include a `companyId` filter derived from the JWT payload. The `authMiddleware` extracts `companyId` from the token; services receive it as a parameter. No route or service may access data from another company.

The only exception: `SUPER_ADMIN` role bypasses company scope checks.

---

## Components and Interfaces

### 1. `middleware/role.ts` — RBAC Guard

```typescript
import type { AuthUser } from "@/types/auth";
import { Roles } from "@/types/role";

export function requireRole(user: AuthUser, ...allowedRoles: string[]): void {
  if (user.role === Roles.SUPER_ADMIN) return;
  if (!allowedRoles.includes(user.role)) {
    const error = new Error("Forbidden");
    (error as any).statusCode = 403;
    throw error;
  }
}
```

Routes call this immediately after `authMiddleware`:

```typescript
const user = authMiddleware(request);
requireRole(user, Roles.OWNER, Roles.MANAGER);
```

### 2. `lib/pagination.ts` — Pagination Utility

```typescript
export type PaginationParams = { page: number; limit: number };
export type PaginationMeta = {
  page: number; limit: number; total: number; totalPages: number;
};

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  if (isNaN(page) || isNaN(limit)) throw new Error("Invalid pagination parameters");
  return { page, limit };
}

export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  };
}
```

### 3. New DB Schema Files

#### `db/schema/supplier.ts`

```typescript
pgTable("suppliers", {
  id: uuid PK,
  companyId: uuid FK → companies(CASCADE),
  name: varchar(150) NOT NULL,
  contactName: varchar(100),
  email: varchar(150),
  phone: varchar(20),
  address: text,
  isActive: boolean default true,
  createdAt, updatedAt: timestamp
})
```

#### `db/schema/purchase.ts`

```typescript
pgEnum("purchase_status", ["PENDING", "RECEIVED", "CANCELLED"])
pgTable("purchases", {
  id, companyId FK → companies(CASCADE), supplierId FK → suppliers(SET NULL),
  referenceNo: varchar(100), purchaseDate: timestamp NOT NULL,
  totalAmount: numeric(14,2) NOT NULL, status: purchase_status default PENDING,
  notes: text, createdAt, updatedAt
})
pgTable("purchase_items", {
  id, purchaseId FK → purchases(CASCADE),
  productItemId FK → product_items(RESTRICT),
  quantity: integer NOT NULL (> 0), unitPrice: numeric(12,2) NOT NULL,
  totalPrice: numeric(14,2) NOT NULL, createdAt, updatedAt
})
```

#### `db/schema/sale.ts`

```typescript
pgEnum("sale_status", ["PENDING", "COMPLETED", "CANCELLED"])
pgTable("sales", {
  id, companyId FK → companies(CASCADE), referenceNo: varchar(100),
  saleDate: timestamp NOT NULL, customerName: varchar(150),
  customerPhone: varchar(20), totalAmount: numeric(14,2) NOT NULL,
  status: sale_status default PENDING, notes: text, createdAt, updatedAt
})
pgTable("sale_items", {
  id, saleId FK → sales(CASCADE),
  productItemId FK → product_items(RESTRICT),
  quantity: integer NOT NULL (> 0), unitPrice: numeric(12,2) NOT NULL,
  totalPrice: numeric(14,2) NOT NULL, createdAt, updatedAt
})
```

#### `db/schema/stock-ledger.ts`

```typescript
pgEnum("movement_type", ["PURCHASE", "SALE", "ADJUSTMENT"])
pgTable("stock_ledger", {
  id, companyId FK → companies(CASCADE),
  productItemId FK → product_items(CASCADE),
  movementType: movement_type NOT NULL,
  referenceType: varchar(50), referenceId: uuid,
  quantityChange: integer NOT NULL,   // positive = in, negative = out
  quantityAfter: integer NOT NULL,    // running total after this entry
  notes: text,
  createdAt: timestamp NOT NULL       // no updatedAt — append-only
})
```

### 4. Services

#### `services/product.service.ts`
- `createProduct(companyId, data)` — inserts product, derives slug, checks duplicate name within company
- `getProducts(companyId, params)` — filtered by `isActive=true`, paginated
- `getProductById(companyId, id)` — scoped to company, returns 404 if missing
- `updateProduct(companyId, id, data)` — partial update, re-derives slug if name changes
- `softDeleteProduct(companyId, id)` — sets `isActive=false`

#### `services/product-option.service.ts`
- `createProductOption(companyId, productId, data)` — verifies product ownership, inserts option
- `getProductOptions(companyId, productId)` — returns active options ordered by `displayOrder`
- `updateProductOption(companyId, productId, optionId, data)`
- `softDeleteProductOption(companyId, productId, optionId)`
- `createProductOptionValue(companyId, productId, optionId, data)`
- `getProductOptionValues(companyId, productId, optionId)`
- `updateProductOptionValue(companyId, productId, optionId, valueId, data)`
- `softDeleteProductOptionValue(companyId, productId, optionId, valueId)`

#### `services/product-item.service.ts` (additions)
- `updateProductItem(companyId, id, data)` — partial update, checks SKU/barcode uniqueness on others
- `deleteProductItem(companyId, id)` — sets `status=DISCONTINUED`
- Both `getProductItemById` and `getProductItems` will include `stockLevel` by joining a subquery against `stock_ledger`

#### `services/company.service.ts`
- `getCompanyById(companyId, id)` — returns 403 if accessing a different company
- `updateCompany(companyId, id, data)` — updates allowed fields only (`name`, `email`, `phone`, `logo`)

#### `services/user.service.ts`
- `getUsers(companyId, params)` — paginated list, excludes `password`
- `createUser(companyId, data)` — hashes password with bcrypt, checks email uniqueness within company
- `getUserById(companyId, id)` — scoped to company
- `updateUser(companyId, actorUserId, id, data)` — prevents self-modification
- `softDeleteUser(companyId, actorUserId, id)` — prevents self-deactivation

#### `services/purchase.service.ts`
- `createPurchase(companyId, data)` — transaction: insert purchase + items, optionally writes ledger if status=RECEIVED
- `getPurchases(companyId, params)` — paginated, ordered by `purchase_date DESC`
- `getPurchaseById(companyId, id)` — includes line items
- `updatePurchase(companyId, id, data)` — handles status transitions, writes/reverses ledger entries
- `deletePurchase(companyId, id)` — only if status=PENDING

#### `services/sale.service.ts`
- `createSale(companyId, data)` — transaction: validates stock levels, inserts sale + items, writes ledger if status=COMPLETED
- `getSales(companyId, params)` — paginated, ordered by `sale_date DESC`
- `getSaleById(companyId, id)` — includes line items
- `updateSale(companyId, id, data)` — handles status transitions, stock enforcement on COMPLETED, reversal on CANCELLED
- `deleteSale(companyId, id)` — only if status=PENDING

#### `services/stock-ledger.service.ts`
- `getStockLedger(companyId, productItemId, params)` — paginated entries, verifies ownership
- `getStockLevel(companyId, productItemId)` — returns `SUM(quantity_change)` for the item
- `writeStockEntry(tx, entry)` — internal helper used by purchase/sale services inside transactions

### 5. Validators

| File | Schemas |
|------|---------|
| `validators/product.validator.ts` | `createProductSchema`, `updateProductSchema` |
| `validators/product-option.validator.ts` | `createProductOptionSchema`, `updateProductOptionSchema`, `createProductOptionValueSchema`, `updateProductOptionValueSchema` |
| `validators/company.validator.ts` | `updateCompanySchema` |
| `validators/user.validator.ts` | `createUserSchema`, `updateUserSchema` |
| `validators/purchase.validator.ts` | `createPurchaseSchema`, `updatePurchaseSchema` |
| `validators/sale.validator.ts` | `createSaleSchema`, `updateSaleSchema` |

### 6. API Routes

#### New Routes

| Method | Path | Auth / RBAC | Handler |
|--------|------|-------------|---------|
| GET    | `/api/products` | any auth | list paginated active products |
| POST   | `/api/products` | MANAGER+ | create product |
| GET    | `/api/products/[id]` | any auth | get product |
| PATCH  | `/api/products/[id]` | MANAGER+ | update product |
| DELETE | `/api/products/[id]` | MANAGER+ | soft-delete product |
| GET    | `/api/products/[id]/options` | any auth | list options |
| POST   | `/api/products/[id]/options` | MANAGER+ | create option |
| PATCH  | `/api/products/[id]/options/[optionId]` | MANAGER+ | update option |
| DELETE | `/api/products/[id]/options/[optionId]` | MANAGER+ | soft-delete option |
| GET    | `/api/products/[id]/options/[optionId]/values` | any auth | list values |
| POST   | `/api/products/[id]/options/[optionId]/values` | MANAGER+ | create value |
| PATCH  | `/api/products/[id]/options/[optionId]/values/[valueId]` | MANAGER+ | update value |
| DELETE | `/api/products/[id]/options/[optionId]/values/[valueId]` | MANAGER+ | soft-delete value |
| GET    | `/api/companies/[id]` | any auth (own company) | get company |
| PATCH  | `/api/companies/[id]` | OWNER only | update company |
| GET    | `/api/users` | OWNER only | list paginated users |
| POST   | `/api/users` | OWNER only | create user |
| GET    | `/api/users/[id]` | OWNER only | get user |
| PATCH  | `/api/users/[id]` | OWNER only | update user |
| DELETE | `/api/users/[id]` | OWNER only | soft-delete user |
| GET    | `/api/purchases` | any auth | list paginated purchases |
| POST   | `/api/purchases` | MANAGER+ | create purchase |
| GET    | `/api/purchases/[id]` | any auth | get purchase with items |
| PATCH  | `/api/purchases/[id]` | MANAGER+ | update status |
| DELETE | `/api/purchases/[id]` | MANAGER+ | delete PENDING purchase |
| GET    | `/api/sales` | any auth | list paginated sales |
| POST   | `/api/sales` | MANAGER+ | create sale |
| GET    | `/api/sales/[id]` | any auth | get sale with items |
| PATCH  | `/api/sales/[id]` | MANAGER+ | update status |
| DELETE | `/api/sales/[id]` | MANAGER+ | delete PENDING sale |
| GET    | `/api/stock-ledger` | any auth | paginated ledger entries |

#### Updated Routes

| Method | Path | Change |
|--------|------|--------|
| GET    | `/api/categories` | Add active filter (default `isActive=true`), add pagination |
| GET    | `/api/product-items` | Add pagination, include `stockLevel` per item |
| PATCH  | `/api/product-items/[id]` | New handler — update item fields |
| DELETE | `/api/product-items/[id]` | New handler — discontinue item |
| GET    | `/api/product-items/[id]` | Include `stockLevel` in response |

---

## Data Models

### Entity Relationship (simplified)

```
companies
  ├── users (companyId FK)
  ├── categories (companyId FK)
  ├── products (companyId FK)
  │     └── product_options (productId FK)
  │           └── product_option_values (optionId FK)
  ├── product_items (productId FK via products → companyId)
  │     └── item_option_values (itemId + optionId + optionValueId)
  ├── suppliers (companyId FK)
  ├── purchases (companyId FK)
  │     └── purchase_items (purchaseId FK, productItemId FK)
  ├── sales (companyId FK)
  │     └── sale_items (saleId FK, productItemId FK)
  └── stock_ledger (companyId FK, productItemId FK)
```

### Stock Level Computation

Stock level is never stored directly; it is always computed on demand:

```sql
SELECT COALESCE(SUM(quantity_change), 0) AS stock_level
FROM stock_ledger
WHERE product_item_id = $1
  AND company_id = $2
```

`quantity_after` in each ledger entry is a denormalized snapshot that enables fast audit log reading without recomputing the full history.

### Purchase Status Transitions

```
PENDING ──► RECEIVED ──► CANCELLED (with reversal ledger entries)
   │
   └──► CANCELLED (no ledger entries if never RECEIVED)
   └──► DELETE allowed only from PENDING
```

### Sale Status Transitions

```
PENDING ──► COMPLETED ──► CANCELLED (with reversal ledger entries)
   │         (stock check)
   └──► CANCELLED (no ledger entries if never COMPLETED)
   └──► DELETE allowed only from PENDING
```

### Migration Plan (`0006_stock_management_completion.sql`)

One new migration file covers:

1. Add `slug varchar(100) NOT NULL DEFAULT ''` to `product_options`
2. Add `is_active boolean DEFAULT true` to `product_options` (already in TS schema but not in migration 0005)
3. Create enum `purchase_status` (PENDING/RECEIVED/CANCELLED)
4. Create enum `sale_status` (PENDING/COMPLETED/CANCELLED)
5. Create enum `movement_type` (PURCHASE/SALE/ADJUSTMENT)
6. Create table `suppliers`
7. Create table `purchases`
8. Create table `purchase_items`
9. Create table `sales`
10. Create table `sale_items`
11. Create table `stock_ledger`

The migration file path: `db/migrations/0006_stock_management_completion.sql`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Slug derivation is consistent

*For any* product or product option name string, the derived `slug` must equal the result of lowercasing the string and replacing every space character with a hyphen.

**Validates: Requirements 1.2, 2.2**

---

### Property 2: Company data isolation

*For any* resource (product, product option, product item, purchase, sale, stock ledger entry) that belongs to company A, a request authenticated as company B must receive HTTP 404 (not the resource).

**Validates: Requirements 1.5, 1.8, 2.12, 7.6, 8.7, 9.5**

---

### Property 3: Active-only list filter

*For any* paginated list endpoint that filters by `isActive`, every item returned in the list must have `isActive = true` when the `includeInactive` parameter is absent or false.

**Validates: Requirements 1.4, 12.1**

---

### Property 4: Duplicate name detection within company scope

*For any* company, attempting to create two products (or product options) with the same `name` under the same `companyId` must return HTTP 409 on the second attempt.

**Validates: Requirements 1.3, 2.3**

---

### Property 5: RBAC blocks STAFF mutations

*For any* mutating operation (POST/PATCH/DELETE) on products, product options, product items, purchases, or sales, a request authenticated with role STAFF must receive HTTP 403, regardless of the request body content.

**Validates: Requirements 1.10, 2.13, 3.6, 7.10, 8.11**

---

### Property 6: RBAC blocks MANAGER and STAFF on company and user mutations

*For any* PATCH on `/api/companies/[id]`, or any POST/PATCH/DELETE on `/api/users`, a request authenticated with role MANAGER or STAFF must receive HTTP 403.

**Validates: Requirements 4.5, 5.8**

---

### Property 7: SKU and barcode uniqueness across items

*For any* product item update that attempts to assign a `sku` or `barcode` already held by a different product item, the system must return HTTP 409.

**Validates: Requirements 3.2, 3.3**

---

### Property 8: Password never appears in user responses

*For any* user record returned by any endpoint (list, get, create, update, delete), the response object must not contain a `password` field.

**Validates: Requirements 5.1, 5.2, 5.5, 5.6**

---

### Property 9: Self-modification prevention

*For any* authenticated user U, a request to update the role or deactivate user U's own account must be rejected with an error.

**Validates: Requirements 5.7**

---

### Property 10: Stock level equals sum of ledger entries

*For any* sequence of stock ledger entries for a product item, the computed `stockLevel` returned by the API must equal the arithmetic sum of all `quantity_change` values for that item in the `stock_ledger` table.

**Validates: Requirements 9.1, 9.2, 9.3**

---

### Property 11: Receiving a purchase writes exactly N ledger entries

*For any* purchase with N line items that transitions to status `RECEIVED`, the system must insert exactly N new `stock_ledger` rows with `movement_type = PURCHASE`, one per purchase item, with the correct `quantity_change` and updated `quantity_after`.

**Validates: Requirements 7.3**

---

### Property 12: Purchase receive → cancel produces net-zero stock change

*For any* product item affected by a purchase that is first received then cancelled, the sum of all `quantity_change` values in the `stock_ledger` for that item attributed to that purchase (original + reversal) must equal zero.

**Validates: Requirements 7.7**

---

### Property 13: Stock floor enforcement on sales

*For any* sale attempting to complete where the resulting `stockLevel` of any line item would fall below zero, the system must return HTTP 422 and must not write any ledger entries.

**Validates: Requirements 8.4**

---

### Property 14: Sale complete → cancel produces net-zero stock change

*For any* product item affected by a sale that is first completed then cancelled, the sum of all `quantity_change` values attributed to that sale (original negative entries + positive reversal entries) must equal zero.

**Validates: Requirements 8.8**

---

### Property 15: Pagination math invariants

*For any* list endpoint called with valid `page` and `limit` parameters, the response must satisfy: `results.length ≤ limit`, `totalPages = ceil(total / limit)`, and `offset = (page - 1) * limit` was applied at the database level.

**Validates: Requirements 11.1, 11.2, 11.4**

---

### Property 16: requireRole guard is correct for all role combinations

*For any* role R and any set of allowed roles S such that R ∉ S, calling `requireRole({ role: R }, ...S)` must throw an error with HTTP status 403. If R is `SUPER_ADMIN`, it must never throw.

**Validates: Requirements 10.1, 10.2, 10.4**

---

## Error Handling

### Typed Service Errors

The existing `ProductItemServiceError` pattern is extended to all services:

```typescript
export class ServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "ServiceError";
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}
```

Each service module re-exports or uses this base class. Status codes used:

| Code | Meaning |
|------|---------|
| 400  | Validation failure (Zod) or bad input |
| 401  | Missing / invalid JWT token |
| 403  | Forbidden (role check failed or wrong company on company route) |
| 404  | Resource not found or out-of-scope |
| 409  | Conflict (duplicate name, SKU, barcode, email) |
| 422  | Unprocessable (stock would go negative) |
| 500  | Unexpected server error |

### Route Error Handling Pattern

Every route handler wraps its logic in a single `try/catch`. The error is mapped to a status code using this priority order:

1. `ZodError` → 400 with `formatZodError()` output
2. `ServiceError` → `error.statusCode`
3. Auth errors (message contains "token" / "authorization") → 401
4. Everything else → 500 with `console.error`

### Transaction Atomicity

All operations that write to multiple tables (create purchase + items + ledger, create sale + items + ledger, status transitions with ledger writes) are wrapped in `db.transaction(async (tx) => { ... })`. If any step fails, the entire transaction rolls back.

---

## Testing Strategy

### Overview

The testing approach uses two complementary layers:

1. **Unit / property-based tests** — test pure service logic against an in-memory or test-database Drizzle instance
2. **Integration tests** — test full HTTP routes end-to-end against a test PostgreSQL database

### Property-Based Testing Library

**[fast-check](https://github.com/dubzzz/fast-check)** is used for property-based testing. It integrates well with Jest/Vitest and supports TypeScript natively.

Each property test is configured to run a minimum of **100 iterations** (`numRuns: 100`).

### Unit / Property Test Targets

| Property | Target Function | fast-check Arbitraries |
|----------|----------------|----------------------|
| P1: Slug derivation | `deriveSlug(name)` (extracted pure fn) | `fc.string()`, `fc.stringOf(fc.char())` |
| P3: Active-only filter | `getProducts`, `getCategories` (service) | Mixed active/inactive item sets |
| P4: Duplicate name detection | `createProduct`, `createProductOption` | Random name + companyId pairs |
| P8: Password exclusion | `getUsers`, `createUser`, `updateUser` | Random user objects |
| P9: Self-modification | `updateUser`, `softDeleteUser` | userId = actorId |
| P10: Stock level sum | `getStockLevel` (service / pure SQL) | Random integer sequences (±) |
| P11: N ledger entries on receive | `updatePurchase` → RECEIVED | Random purchase with 1–10 items |
| P12: Receive then cancel = net zero | purchase workflow | Random purchase quantities |
| P13: Stock floor on sales | `createSale` / `updateSale` → COMPLETED | Over-sell scenarios |
| P14: Complete then cancel = net zero | sale workflow | Random sale quantities |
| P15: Pagination math | `parsePaginationParams`, `buildPaginationMeta` | `fc.integer({ min:1, max:200 })` |
| P16: requireRole guard | `requireRole()` | All role combinations |

### Property Test Tag Format

Each property test is tagged in a comment directly above the test:

```typescript
// Feature: stock-management-backend-completion, Property 1: slug derivation is consistent
test.prop([fc.string()], { numRuns: 100 })("slug derivation", (name) => { ... });
```

### Integration Test Coverage

Integration tests (using a separate test PostgreSQL database seeded before each suite) cover:

- Company data isolation (P2): cross-company 404 on all resource types
- RBAC rules (P5, P6): each forbidden role + each protected route
- SKU/barcode uniqueness (P7): conflict detection on update
- Zod validation: 400 responses for malformed inputs on every POST/PATCH endpoint
- Stock level in product item responses (P10 integration aspect)
- Purchase and sale full lifecycle: create → receive/complete → cancel

### Unit Test Coverage

Unit tests (example-based) cover:

- `requireRole` — all 16 role × allowed-set combinations
- `parsePaginationParams` — boundary values (page=0, limit=101, non-numeric)
- `buildPaginationMeta` — edge cases (0 total, 1 item)
- Slug derivation — known inputs (e.g., `"Men EVA Slipper"` → `"men-eva-slipper"`)
- `formatZodError` — existing utility

### Notes on PBT Applicability

PBT is appropriate here because the core business logic (slug derivation, stock level computation, role checking, pagination math, ledger round-trips) consists of pure or near-pure functions where input variation directly reveals edge cases. Infrastructure concerns (the migration itself, the company record structure) are covered by smoke/integration tests, not property tests.
