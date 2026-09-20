# Implementation Plan: Stock Management Backend Completion

## Overview

Implement all missing backend functionality for the multi-tenant stock management SaaS following the established `API Route → authMiddleware → requireRole → Service → Drizzle ORM → PostgreSQL` pattern. Tasks are ordered to build foundational infrastructure first, then domain features, then the stock ledger, with integration last.

## Tasks

- [x] 1. Set up shared infrastructure (RBAC guard, pagination utility, base error class, slug helper)
  - [x] 1.1 Create `middleware/role.ts` with `requireRole` guard function
    - Export `requireRole(user: AuthUser, ...allowedRoles: string[]): void`
    - SUPER_ADMIN always passes; any other role not in `allowedRoles` throws `{ statusCode: 403 }`
    - _Requirements: 10.1, 10.2, 10.4_

  - [ ]* 1.2 Write property tests for `requireRole`
    - **Property 16: requireRole guard is correct for all role combinations**
    - Use `fc.constantFrom` over all Role values × allowed-set combinations; assert throw on mismatch and no-throw for SUPER_ADMIN
    - **Validates: Requirements 10.1, 10.2, 10.4**

  - [x] 1.3 Create `lib/pagination.ts` with `parsePaginationParams` and `buildPaginationMeta`
    - `parsePaginationParams` clamps `page ≥ 1`, `1 ≤ limit ≤ 100`, throws on NaN
    - `buildPaginationMeta` returns `{ page, limit, total, totalPages: ceil(total/limit) }`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 1.4 Write property tests for pagination utilities
    - **Property 15: Pagination math invariants**
    - Use `fc.integer({ min: 1, max: 200 })` for page/limit/total; assert `totalPages = ceil(total/limit)` and `results.length ≤ limit`
    - **Validates: Requirements 11.1, 11.2, 11.4**

  - [x] 1.5 Create `lib/derive-slug.ts` with pure `deriveSlug(name: string): string` helper
    - Lowercase the string and replace every space character with a hyphen
    - _Requirements: 1.2, 2.2_

  - [ ]* 1.6 Write property tests for slug derivation
    - **Property 1: Slug derivation is consistent**
    - Use `fc.string()` and `fc.stringOf(fc.char())`; assert output equals `name.toLowerCase().replace(/ /g, '-')`
    - **Validates: Requirements 1.2, 2.2**

  - [x] 1.7 Create `lib/service-error.ts` with base `ServiceError` class
    - Extend `Error` with `statusCode: number` (default 400); set prototype chain correctly
    - Export and re-use in all new services to replace per-service error classes
    - _Requirements: design error-handling section_

- [ ] 2. DB migrations — new schema and bug-fix columns
  - [x] 2.1 Write migration SQL `db/migrations/0006_stock_management_completion.sql`
    - Add `slug VARCHAR(100) NOT NULL DEFAULT ''` and `is_active BOOLEAN DEFAULT true` to `product_options`
    - Create enums: `purchase_status`, `sale_status`, `movement_type`
    - Create tables: `suppliers`, `purchases`, `purchase_items`, `sales`, `sale_items`, `stock_ledger`
    - Use CASCADE / SET NULL / RESTRICT FK rules per requirements spec
    - _Requirements: 6.1–6.8, 13.1_

  - [ ] 2.2 Create Drizzle schema files for new tables
    - `db/schema/supplier.ts` — `suppliers` table
    - `db/schema/purchase.ts` — `purchases` + `purchase_items` + `purchaseStatusEnum`
    - `db/schema/sale.ts` — `sales` + `sale_items` + `saleStatusEnum`
    - `db/schema/stock-ledger.ts` — `stock_ledger` + `movementTypeEnum` (no `updatedAt`)
    - Export all new tables from `db/schema/index.ts`
    - _Requirements: 6.1–6.6_

  - [~] 2.3 Update `db/relations.ts` to include relations for all new tables
    - Add one-to-many relations: company → suppliers, company → purchases, company → sales, company → stock_ledger
    - Add relations for purchase ↔ purchase_items, sale ↔ sale_items, product_item ↔ stock_ledger
    - _Requirements: 6.1–6.6_

- [ ] 3. Bug fix — categories active filter and product_options slug
  - [~] 3.1 Update `services/category.service.ts` to filter `isActive = true` by default
    - Accept optional `includeInactive` boolean; omit the filter only when it is `true`
    - _Requirements: 12.1, 12.2_

  - [~] 3.2 Update `app/api/categories/route.ts` GET handler to pass `includeInactive` param
    - Read `includeInactive` query param and forward to service
    - Keep `app/api/categories/[id]/route.ts` GET unchanged (returns regardless of `isActive`)
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 4. Products CRUD
  - [~] 4.1 Create `validators/product.validator.ts`
    - `createProductSchema`: `name` (string), `description` (optional), `categoryId` (optional UUID), `isActive` (optional boolean)
    - `updateProductSchema`: all fields optional (partial)
    - _Requirements: 1.9_

  - [~] 4.2 Create `services/product.service.ts`
    - `createProduct(companyId, data)` — derive slug, check duplicate name within company (409), insert, return
    - `getProducts(companyId, params)` — filter `isActive=true`, paginated with offset/limit from `lib/pagination.ts`
    - `getProductById(companyId, id)` — company-scoped, throws 404 if missing
    - `updateProduct(companyId, id, data)` — partial update, re-derive slug if name changes, company-scoped
    - `softDeleteProduct(companyId, id)` — set `isActive=false`, company-scoped
    - _Requirements: 1.1–1.9_

  - [ ]* 4.3 Write property tests for `createProduct` and `getProducts`
    - **Property 3: Active-only list filter** — assert every item in paginated list has `isActive = true`
    - **Property 4: Duplicate name detection within company scope** — assert second create with same name returns 409
    - **Validates: Requirements 1.3, 1.4**

  - [~] 4.4 Create `app/api/products/route.ts` (GET + POST)
    - POST: `authMiddleware` → `requireRole(MANAGER, OWNER)` → validate → `createProduct` → 201
    - GET: `authMiddleware` → `parsePaginationParams` → `getProducts` → 200 with `pagination` meta
    - _Requirements: 1.1, 1.4, 1.10, 10.3_

  - [~] 4.5 Create `app/api/products/[id]/route.ts` (GET + PATCH + DELETE)
    - GET: any auth → `getProductById` → 200
    - PATCH: `requireRole(MANAGER, OWNER)` → validate → `updateProduct` → 200
    - DELETE: `requireRole(MANAGER, OWNER)` → `softDeleteProduct` → 200
    - _Requirements: 1.5–1.8, 1.10, 10.3_

- [ ] 5. Product Options CRUD
  - [~] 5.1 Create `validators/product-option.validator.ts`
    - `createProductOptionSchema`, `updateProductOptionSchema`, `createProductOptionValueSchema`, `updateProductOptionValueSchema`
    - _Requirements: 2.1–2.13_

  - [~] 5.2 Create `services/product-option.service.ts`
    - `createProductOption(companyId, productId, data)` — verify product ownership, derive slug, 409 on duplicate name
    - `getProductOptions(companyId, productId)` — active only, ordered by `displayOrder`
    - `updateProductOption(companyId, productId, optionId, data)`
    - `softDeleteProductOption(companyId, productId, optionId)` — `isActive=false`
    - `createProductOptionValue(companyId, productId, optionId, data)` — 409 on duplicate value
    - `getProductOptionValues(companyId, productId, optionId)` — active, ordered by `displayOrder`
    - `updateProductOptionValue(companyId, productId, optionId, valueId, data)`
    - `softDeleteProductOptionValue(companyId, productId, optionId, valueId)` — `isActive=false`
    - _Requirements: 2.1–2.13_

  - [~] 5.3 Create `app/api/products/[id]/options/route.ts` (GET + POST)
    - POST: `requireRole(MANAGER, OWNER)` → validate → `createProductOption` → 201
    - GET: any auth → `getProductOptions` → 200
    - _Requirements: 2.1–2.4, 2.13, 10.3_

  - [~] 5.4 Create `app/api/products/[id]/options/[optionId]/route.ts` (PATCH + DELETE)
    - PATCH: `requireRole(MANAGER, OWNER)` → validate → `updateProductOption` → 200
    - DELETE: `requireRole(MANAGER, OWNER)` → `softDeleteProductOption` → 200
    - _Requirements: 2.5–2.6, 2.13, 10.3_

  - [~] 5.5 Create `app/api/products/[id]/options/[optionId]/values/route.ts` (GET + POST)
    - POST: `requireRole(MANAGER, OWNER)` → validate → `createProductOptionValue` → 201
    - GET: any auth → `getProductOptionValues` → 200
    - _Requirements: 2.7–2.9, 2.13, 10.3_

  - [~] 5.6 Create `app/api/products/[id]/options/[optionId]/values/[valueId]/route.ts` (PATCH + DELETE)
    - PATCH: `requireRole(MANAGER, OWNER)` → validate → `updateProductOptionValue` → 200
    - DELETE: `requireRole(MANAGER, OWNER)` → `softDeleteProductOptionValue` → 200
    - _Requirements: 2.10–2.13, 10.3_

- [ ] 6. Product Items — update and delete (complete the CRUD)
  - [~] 6.1 Add `updateProductItemSchema` to `validators/product-item.validator.ts`
    - All fields optional partial: `sku`, `barcode`, `purchasePrice`, `sellingPrice`, `mrp`, `weight`, `status`
    - _Requirements: 3.1_

  - [~] 6.2 Add `updateProductItem` and `deleteProductItem` to `services/product-item.service.ts`
    - `updateProductItem(companyId, id, data)` — partial update, check SKU/barcode uniqueness on other items (409)
    - `deleteProductItem(companyId, id)` — set `status = DISCONTINUED`, company-scoped via joined product
    - _Requirements: 3.1–3.5_

  - [~] 6.3 Update `app/api/product-items/[id]/route.ts` with PATCH and DELETE handlers
    - PATCH: `requireRole(MANAGER, OWNER)` → validate → `updateProductItem` → 200
    - DELETE: `requireRole(MANAGER, OWNER)` → `deleteProductItem` → 200
    - _Requirements: 3.1–3.6, 10.3_

- [ ] 7. Company profile management
  - [~] 7.1 Create `validators/company.validator.ts` with `updateCompanySchema`
    - Allow only: `name`, `email`, `phone`, `logo`; reject `slug`, `subscriptionPlan`, `isActive`
    - _Requirements: 4.3, 4.4_

  - [~] 7.2 Create `services/company.service.ts`
    - `getCompanyById(companyId, id)` — returns 403 if `id !== companyId`
    - `updateCompany(companyId, id, data)` — update allowed fields only; 403 if different company
    - _Requirements: 4.1–4.5_

  - [~] 7.3 Create `app/api/companies/[id]/route.ts` (GET + PATCH)
    - GET: any auth → `getCompanyById` → 200
    - PATCH: `requireRole(OWNER)` → validate → `updateCompany` → 200
    - _Requirements: 4.1–4.5, 10.3_

- [ ] 8. User management
  - [~] 8.1 Create `validators/user.validator.ts`
    - `createUserSchema`: `name`, `email`, `password`, `role`
    - `updateUserSchema`: `name` and/or `role` (partial)
    - _Requirements: 5.9_

  - [~] 8.2 Create `services/user.service.ts`
    - `getUsers(companyId, params)` — paginated, select all fields except `password`
    - `createUser(companyId, data)` — hash password with bcrypt, 409 on duplicate email within company, return without `password`
    - `getUserById(companyId, id)` — company-scoped, without `password`
    - `updateUser(companyId, actorUserId, id, data)` — prevent self-modification (self-role change), without `password`
    - `softDeleteUser(companyId, actorUserId, id)` — `isActive=false`, prevent self-deactivation
    - _Requirements: 5.1–5.8_

  - [ ]* 8.3 Write property tests for user service
    - **Property 8: Password never appears in user responses** — generate random user objects; assert no `password` key in any response shape
    - **Property 9: Self-modification prevention** — assert `updateUser` and `softDeleteUser` throw when `actorUserId === id`
    - **Validates: Requirements 5.2, 5.6, 5.7**

  - [~] 8.4 Create `app/api/users/route.ts` (GET + POST) — OWNER only
    - GET: `requireRole(OWNER)` → `getUsers` with pagination → 200 with `pagination`
    - POST: `requireRole(OWNER)` → validate → `createUser` → 201
    - _Requirements: 5.1–5.3, 5.8, 10.3_

  - [~] 8.5 Create `app/api/users/[id]/route.ts` (GET + PATCH + DELETE) — OWNER only
    - GET: `requireRole(OWNER)` → `getUserById` → 200
    - PATCH: `requireRole(OWNER)` → validate → `updateUser` → 200
    - DELETE: `requireRole(OWNER)` → `softDeleteUser` → 200
    - _Requirements: 5.4–5.8, 10.3_

- [~] 9. Checkpoint — ensure all tests pass and existing routes still work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Stock ledger — schema, helper, and read endpoint
  - [~] 10.1 Create `services/stock-ledger.service.ts`
    - `writeStockEntry(tx, entry)` — internal helper: computes `quantity_after` via `getStockLevel`, inserts row; used inside transactions
    - `getStockLevel(companyId, productItemId): Promise<number>` — `COALESCE(SUM(quantity_change), 0)` from `stock_ledger`
    - `getStockLedger(companyId, productItemId, params)` — verify ownership, paginated entries
    - _Requirements: 9.1, 9.4, 9.5_

  - [ ]* 10.2 Write property tests for stock level computation
    - **Property 10: Stock level equals sum of ledger entries**
    - Use `fc.array(fc.integer({ min: -100, max: 100 }))` as random `quantity_change` sequences; assert `getStockLevel` equals the arithmetic sum
    - **Validates: Requirements 9.1**

  - [~] 10.3 Create `app/api/stock-ledger/route.ts` (GET only)
    - Require `productItemId` query param; any auth → `getStockLedger` with pagination → 200
    - Return 404 if item doesn't belong to company (per service)
    - _Requirements: 9.4, 9.5_

  - [~] 10.4 Update `getProductItemById` and `getProductItems` in `services/product-item.service.ts` to include `stockLevel`
    - Join `stock_ledger` subquery (`SUM(quantity_change)` grouped by `product_item_id`) per item
    - Add `stockLevel: number` to the return type
    - _Requirements: 9.2, 9.3_

  - [~] 10.5 Update `app/api/product-items/route.ts` GET and `app/api/product-items/[id]/route.ts` GET to add pagination
    - Parse `page`/`limit` from `parsePaginationParams` and return with `pagination` meta in list response
    - _Requirements: 11.1, 11.2_

- [ ] 11. Purchases (stock in)
  - [~] 11.1 Create `validators/purchase.validator.ts`
    - `createPurchaseSchema`: `supplierId` (optional UUID), `referenceNo` (optional), `purchaseDate`, `status` (default PENDING), `notes` (optional), `items` array with `productItemId`, `quantity`, `unitPrice`
    - `updatePurchaseSchema`: `status` only (RECEIVED or CANCELLED)
    - _Requirements: 7.9_

  - [~] 11.2 Create `services/purchase.service.ts`
    - `createPurchase(companyId, data)` — transaction: validate all `product_item_id` ownership, insert purchase + items, call `writeStockEntry` per item if `status=RECEIVED`
    - `getPurchases(companyId, params)` — paginated, ordered by `purchase_date DESC`
    - `getPurchaseById(companyId, id)` — includes line items, 404 if not found
    - `updatePurchase(companyId, id, data)` — status transitions: PENDING→RECEIVED (write ledger), RECEIVED→CANCELLED (write reversal ledger), block RECEIVED→PENDING
    - `deletePurchase(companyId, id)` — 409 unless `status=PENDING`
    - _Requirements: 7.1–7.9_

  - [ ]* 11.3 Write property tests for purchase ledger invariants
    - **Property 11: Receiving a purchase writes exactly N ledger entries** — use `fc.array(fc.record({ quantity: fc.integer({ min: 1, max: 100 }) }), { minLength: 1, maxLength: 10 })`; assert exactly N `stock_ledger` rows inserted with `movement_type=PURCHASE`
    - **Property 12: Purchase receive → cancel produces net-zero stock change** — assert `SUM(quantity_change)` for the purchase's items = 0 after cancellation
    - **Validates: Requirements 7.3, 7.7**

  - [~] 11.4 Create `app/api/purchases/route.ts` (GET + POST)
    - POST: `requireRole(MANAGER, OWNER)` → validate → `createPurchase` → 201
    - GET: any auth → `parsePaginationParams` → `getPurchases` → 200 with `pagination`
    - _Requirements: 7.1, 7.5, 7.10, 10.3_

  - [~] 11.5 Create `app/api/purchases/[id]/route.ts` (GET + PATCH + DELETE)
    - GET: any auth → `getPurchaseById` → 200
    - PATCH: `requireRole(MANAGER, OWNER)` → validate → `updatePurchase` → 200
    - DELETE: `requireRole(MANAGER, OWNER)` → `deletePurchase` → 200 or 409
    - _Requirements: 7.4, 7.6–7.8, 7.10, 10.3_

- [ ] 12. Sales (stock out)
  - [~] 12.1 Create `validators/sale.validator.ts`
    - `createSaleSchema`: `referenceNo` (optional), `saleDate`, `customerName` (optional), `customerPhone` (optional), `status` (default PENDING), `notes` (optional), `items` array with `productItemId`, `quantity`, `unitPrice`
    - `updateSaleSchema`: `status` only (COMPLETED or CANCELLED)
    - _Requirements: 8.10_

  - [~] 12.2 Create `services/sale.service.ts`
    - `createSale(companyId, data)` — transaction: validate ownership, if `status=COMPLETED` check stock floor (422 if any item would go negative), insert sale + items, call `writeStockEntry` per item with negative `quantity_change`
    - `getSales(companyId, params)` — paginated, ordered by `sale_date DESC`
    - `getSaleById(companyId, id)` — includes line items, 404 if not found
    - `updateSale(companyId, id, data)` — transitions: PENDING→COMPLETED (stock check + ledger), COMPLETED→CANCELLED (reversal ledger), block COMPLETED→PENDING
    - `deleteSale(companyId, id)` — 409 unless `status=PENDING`
    - _Requirements: 8.1–8.9_

  - [ ]* 12.3 Write property tests for sale ledger invariants
    - **Property 13: Stock floor enforcement on sales** — assert that attempting to complete a sale where any item's resulting stock < 0 returns HTTP 422 and inserts 0 ledger rows
    - **Property 14: Sale complete → cancel produces net-zero stock change** — assert `SUM(quantity_change)` for the sale's items = 0 after cancellation
    - **Validates: Requirements 8.4, 8.8**

  - [~] 12.4 Create `app/api/sales/route.ts` (GET + POST)
    - POST: `requireRole(MANAGER, OWNER)` → validate → `createSale` → 201
    - GET: any auth → `parsePaginationParams` → `getSales` → 200 with `pagination`
    - _Requirements: 8.1, 8.6, 8.11, 10.3_

  - [~] 12.5 Create `app/api/sales/[id]/route.ts` (GET + PATCH + DELETE)
    - GET: any auth → `getSaleById` → 200
    - PATCH: `requireRole(MANAGER, OWNER)` → validate → `updateSale` → 200
    - DELETE: `requireRole(MANAGER, OWNER)` → `deleteSale` → 200 or 409
    - _Requirements: 8.5, 8.7–8.9, 8.11, 10.3_

- [ ] 13. Apply pagination to remaining existing list endpoints
  - [~] 13.1 Update `app/api/categories/route.ts` GET to support pagination
    - Use `parsePaginationParams`, apply offset/limit in DB query, return `pagination` meta
    - _Requirements: 11.1, 11.2_

  - [~] 13.2 Update `services/category.service.ts` to accept and apply pagination params
    - Accept `PaginationParams`, return `{ data, total }` so route can build pagination meta
    - _Requirements: 11.4_

- [~] 14. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- `fast-check` is the PBT library; install it with `npm install --save-dev fast-check` before running property tests
- All new services follow the `ServiceError` base class from `lib/service-error.ts` (task 1.7)
- The migration in task 2.1 must be applied via `npm run db:migrate` before services that use new tables can function
- `db.transaction(async (tx) => { ... })` must wrap all multi-table writes (purchases, sales, ledger entries)
- Property tests are tagged `// Feature: stock-management-backend-completion, Property N: ...` per the design testing strategy

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.5", "1.7", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1", "4.1", "5.1", "6.1", "7.1", "8.1", "11.1", "12.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "5.2", "6.2", "7.2", "8.2", "10.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.3", "6.3", "7.3", "8.3", "10.2", "10.3", "10.4", "11.2", "12.2"] },
    { "id": 5, "tasks": ["4.5", "5.4", "5.5", "8.4", "10.5", "11.3", "12.3", "13.1"] },
    { "id": 6, "tasks": ["5.6", "8.5", "11.4", "12.4", "13.2"] },
    { "id": 7, "tasks": ["11.5", "12.5"] }
  ]
}
```
