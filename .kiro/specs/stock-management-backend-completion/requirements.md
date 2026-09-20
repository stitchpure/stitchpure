# Requirements Document

## Introduction

This document defines requirements for completing the backend of a multi-tenant stock management / e-commerce SaaS application built with Next.js 16 (App Router), Drizzle ORM, PostgreSQL, JWT authentication, Zod validation, and bcrypt.

The system already has auth, categories CRUD, and product item create/read. This spec covers all missing backend functionality: Products CRUD, Product Options CRUD, Product Item update/delete, Company profile management, User management, Purchases (stock in), Sales (stock out), Inventory/stock ledger tracking, Role-Based Access Control (RBAC), pagination, new DB migrations, and two known bug fixes.

The architecture for all new features follows the existing pattern: `API Route → authMiddleware → Service → Drizzle ORM → PostgreSQL`.

---

## Glossary

- **System**: The stock management SaaS backend application
- **API**: The Next.js App Router API layer
- **Product**: A named, catalogued item belonging to a company (e.g. "Men EVA Slipper")
- **Product_Option**: A variant dimension of a product (e.g. Size, Color)
- **Product_Option_Value**: A specific value for a Product_Option (e.g. Size=7, Color=Black)
- **Product_Item**: A sellable SKU — a unique combination of a Product with specific Product_Option_Values (e.g. Men EVA Slipper, Size 7, Black)
- **Supplier**: A vendor from whom the company purchases goods
- **Purchase**: A purchase order representing stock intake from a Supplier
- **Purchase_Item**: A line item within a Purchase, referencing a Product_Item and a quantity/price
- **Sale**: A sales order representing stock outflow to a customer
- **Sale_Item**: A line item within a Sale, referencing a Product_Item and a quantity/price
- **Stock_Ledger**: An append-only log of every stock movement (in or out) for each Product_Item
- **Stock_Level**: The current quantity on hand for a Product_Item, derived from the Stock_Ledger
- **RBAC**: Role-Based Access Control — restricting operations based on the authenticated user's role
- **Role**: One of OWNER, MANAGER, STAFF, or SUPER_ADMIN as defined in `types/role.ts`
- **Pagination**: Cursor-less offset-based pagination via `page` and `limit` query parameters
- **authMiddleware**: The existing JWT verification middleware at `middleware/auth.ts`
- **AuthUser**: The decoded JWT payload containing `userId`, `companyId`, and `role`
- **Slug**: A URL-safe lowercase string derived from a name (spaces replaced with hyphens)
- **Soft_Delete**: Setting `isActive = false` rather than removing a row from the database
- **Company**: The multi-tenant root entity owning all data for one business
- **companyId**: The UUID of the authenticated user's company, extracted from the JWT by authMiddleware

---

## Requirements

---

### Requirement 1: Products CRUD

**User Story:** As a MANAGER or OWNER, I want to create, read, update, and soft-delete products, so that I can maintain my product catalogue.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/products` with a valid body, THE System SHALL create a new product scoped to the authenticated user's `companyId` and return it with HTTP 201.
2. THE System SHALL derive the product `slug` from the product `name` by lowercasing and replacing spaces with hyphens.
3. IF a product with the same `name` already exists for the same `companyId`, THEN THE System SHALL return HTTP 409 with a descriptive error message.
4. WHEN a GET request is made to `/api/products`, THE System SHALL return a paginated list of active products (`isActive = true`) scoped to the authenticated user's `companyId`.
5. WHEN a GET request is made to `/api/products/[id]`, THE System SHALL return the product if it exists and belongs to the authenticated user's `companyId`, or HTTP 404 if not found.
6. WHEN a PATCH request is made to `/api/products/[id]` with a valid body, THE System SHALL update only the provided fields and return the updated product.
7. WHEN a DELETE request is made to `/api/products/[id]`, THE System SHALL perform a Soft_Delete by setting `isActive = false` and return the updated product.
8. IF a product update or delete targets a product that does not belong to the authenticated user's `companyId`, THEN THE System SHALL return HTTP 404.
9. IF the request body for product create or update fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
10. WHILE a user's role is STAFF, THE System SHALL deny product create, update, and delete operations with HTTP 403.

---

### Requirement 2: Product Options CRUD

**User Story:** As a MANAGER or OWNER, I want to manage variant options and their values per product, so that I can define dimensions like Size and Color for my SKUs.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/products/[id]/options` with a valid body, THE System SHALL create a Product_Option for the specified product scoped to the authenticated user's `companyId` and return it with HTTP 201.
2. THE System SHALL derive the Product_Option `slug` from the option `name`.
3. IF a Product_Option with the same `name` already exists for the same product, THEN THE System SHALL return HTTP 409.
4. WHEN a GET request is made to `/api/products/[id]/options`, THE System SHALL return all active Product_Options for the specified product ordered by `displayOrder`.
5. WHEN a PATCH request is made to `/api/products/[id]/options/[optionId]`, THE System SHALL update the option and return the updated record.
6. WHEN a DELETE request is made to `/api/products/[id]/options/[optionId]`, THE System SHALL perform a Soft_Delete on the Product_Option by setting `isActive = false`.
7. WHEN a POST request is made to `/api/products/[id]/options/[optionId]/values` with a valid body, THE System SHALL create a Product_Option_Value for the specified option and return it with HTTP 201.
8. IF a Product_Option_Value with the same `value` already exists for the same option, THEN THE System SHALL return HTTP 409.
9. WHEN a GET request is made to `/api/products/[id]/options/[optionId]/values`, THE System SHALL return all active Product_Option_Values for the specified option ordered by `displayOrder`.
10. WHEN a PATCH request is made to `/api/products/[id]/options/[optionId]/values/[valueId]`, THE System SHALL update the value and return the updated record.
11. WHEN a DELETE request is made to `/api/products/[id]/options/[optionId]/values/[valueId]`, THE System SHALL perform a Soft_Delete by setting `isActive = false`.
12. IF any option or option-value operation targets a product that does not belong to the authenticated user's `companyId`, THEN THE System SHALL return HTTP 404.
13. WHILE a user's role is STAFF, THE System SHALL deny option and option-value create, update, and delete operations with HTTP 403.

---

### Requirement 3: Product Items — Update and Delete

**User Story:** As a MANAGER or OWNER, I want to update and deactivate SKUs, so that I can adjust pricing, status, and retire discontinued items.

#### Acceptance Criteria

1. WHEN a PATCH request is made to `/api/product-items/[id]` with a valid body, THE System SHALL update the provided fields (`sku`, `barcode`, `purchasePrice`, `sellingPrice`, `mrp`, `weight`, `status`) and return the updated Product_Item.
2. IF a PATCH request would set a `sku` that already exists on a different Product_Item, THEN THE System SHALL return HTTP 409.
3. IF a PATCH request would set a `barcode` that already exists on a different Product_Item, THEN THE System SHALL return HTTP 409.
4. WHEN a DELETE request is made to `/api/product-items/[id]`, THE System SHALL set the Product_Item `status` to `DISCONTINUED` and return the updated record.
5. IF the target Product_Item does not belong to the authenticated user's `companyId` (via the joined product), THEN THE System SHALL return HTTP 404.
6. WHILE a user's role is STAFF, THE System SHALL deny product item update and delete operations with HTTP 403.

---

### Requirement 4: Company Profile Management

**User Story:** As an OWNER, I want to read and update my company profile, so that I can keep business information current.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/companies/[id]`, THE System SHALL return the company record if the authenticated user belongs to that company, or HTTP 403 if the user belongs to a different company.
2. WHEN a PATCH request is made to `/api/companies/[id]` with a valid body, THE System SHALL update the allowed fields (`name`, `email`, `phone`, `logo`) and return the updated company.
3. THE System SHALL NOT allow updates to `slug`, `subscriptionPlan`, or `isActive` through this endpoint.
4. IF the request body for company update fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
5. WHILE a user's role is MANAGER or STAFF, THE System SHALL deny company update (PATCH) operations with HTTP 403.

---

### Requirement 5: User Management

**User Story:** As an OWNER, I want to list, create, update role, and deactivate users within my company, so that I can control team access.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/users`, THE System SHALL return a paginated list of users belonging to the authenticated user's `companyId`, excluding password fields.
2. WHEN a POST request is made to `/api/users` with a valid body, THE System SHALL create a new user under the authenticated user's `companyId`, hash the password with bcrypt, and return the user (without the password) with HTTP 201.
3. IF a user with the same `email` already exists in the same company, THEN THE System SHALL return HTTP 409.
4. WHEN a GET request is made to `/api/users/[id]`, THE System SHALL return the user if they belong to the authenticated user's `companyId`, or HTTP 404 if not found.
5. WHEN a PATCH request is made to `/api/users/[id]` with a valid body, THE System SHALL update allowed fields (`name`, `role`) and return the updated user (without the password).
6. WHEN a DELETE request is made to `/api/users/[id]`, THE System SHALL perform a Soft_Delete by setting `isActive = false` and return the updated user (without the password).
7. THE System SHALL NOT allow a user to deactivate or change the role of their own account.
8. WHILE a user's role is MANAGER or STAFF, THE System SHALL deny user create, update, and delete operations with HTTP 403.
9. IF the request body for user create or update fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.

---

### Requirement 6: DB Migrations for New Tables

**User Story:** As a developer, I want DB migration SQL files for all missing tables, so that the database schema stays in sync with the application code.

#### Acceptance Criteria

1. THE System SHALL include a migration that creates the `suppliers` table with columns: `id` (UUID PK), `company_id` (UUID FK → companies, CASCADE), `name` (varchar 150, not null), `contact_name` (varchar 100), `email` (varchar 150), `phone` (varchar 20), `address` (text), `is_active` (boolean default true), `created_at`, `updated_at`.
2. THE System SHALL include a migration that creates the `purchases` table with columns: `id` (UUID PK), `company_id` (UUID FK → companies, CASCADE), `supplier_id` (UUID FK → suppliers, SET NULL), `reference_no` (varchar 100), `purchase_date` (timestamp not null), `total_amount` (numeric 14,2 not null), `status` (enum: PENDING/RECEIVED/CANCELLED, default PENDING), `notes` (text), `created_at`, `updated_at`.
3. THE System SHALL include a migration that creates the `purchase_items` table with columns: `id` (UUID PK), `purchase_id` (UUID FK → purchases, CASCADE), `product_item_id` (UUID FK → product_items, RESTRICT), `quantity` (integer not null, > 0), `unit_price` (numeric 12,2 not null), `total_price` (numeric 14,2 not null), `created_at`, `updated_at`.
4. THE System SHALL include a migration that creates the `sales` table with columns: `id` (UUID PK), `company_id` (UUID FK → companies, CASCADE), `reference_no` (varchar 100), `sale_date` (timestamp not null), `customer_name` (varchar 150), `customer_phone` (varchar 20), `total_amount` (numeric 14,2 not null), `status` (enum: PENDING/COMPLETED/CANCELLED, default PENDING), `notes` (text), `created_at`, `updated_at`.
5. THE System SHALL include a migration that creates the `sale_items` table with columns: `id` (UUID PK), `sale_id` (UUID FK → sales, CASCADE), `product_item_id` (UUID FK → product_items, RESTRICT), `quantity` (integer not null, > 0), `unit_price` (numeric 12,2 not null), `total_price` (numeric 14,2 not null), `created_at`, `updated_at`.
6. THE System SHALL include a migration that creates the `stock_ledger` table with columns: `id` (UUID PK), `company_id` (UUID FK → companies, CASCADE), `product_item_id` (UUID FK → product_items, CASCADE), `movement_type` (enum: PURCHASE/SALE/ADJUSTMENT, not null), `reference_type` (varchar 50), `reference_id` (UUID), `quantity_change` (integer not null — positive for in, negative for out), `quantity_after` (integer not null), `notes` (text), `created_at` (timestamp not null).
7. THE System SHALL include a migration that adds the missing `slug` column (varchar 100, not null) to the `product_options` table.
8. THE System SHALL include a migration that adds the `is_active` column (boolean default true) to the `product_options` table if it is missing.

---

### Requirement 7: Purchases (Stock In)

**User Story:** As a MANAGER or OWNER, I want to create and manage purchase orders, so that I can record stock intake and update inventory levels.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/purchases` with a valid body, THE System SHALL create a Purchase with its line items (Purchase_Items) in a single database transaction, return the Purchase with HTTP 201.
2. THE System SHALL validate that every `product_item_id` in the purchase line items belongs to the authenticated user's `companyId`.
3. WHEN the purchase `status` is set to `RECEIVED` (on create or PATCH), THE System SHALL insert one Stock_Ledger record per Purchase_Item with `movement_type = PURCHASE` and update `quantity_after` to reflect the new running total.
4. IF a purchase is set to `RECEIVED`, THEN THE System SHALL prevent changing its status back to `PENDING`.
5. WHEN a GET request is made to `/api/purchases`, THE System SHALL return a paginated list of purchases scoped to the authenticated user's `companyId`, ordered by `purchase_date` descending.
6. WHEN a GET request is made to `/api/purchases/[id]`, THE System SHALL return the purchase with all its line items if it belongs to the authenticated user's `companyId`, or HTTP 404.
7. WHEN a PATCH request is made to `/api/purchases/[id]` with status `CANCELLED`, THE System SHALL update the status; IF the purchase was previously `RECEIVED`, THEN THE System SHALL insert reversal Stock_Ledger entries with negative `quantity_change`.
8. WHEN a DELETE request is made to `/api/purchases/[id]`, THE System SHALL only allow deletion when the purchase `status` is `PENDING`; IF the status is `RECEIVED` or `CANCELLED`, THEN THE System SHALL return HTTP 409.
9. IF the request body fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
10. WHILE a user's role is STAFF, THE System SHALL deny purchase create, update, and delete operations with HTTP 403.

---

### Requirement 8: Sales (Stock Out)

**User Story:** As a MANAGER or OWNER, I want to create and manage sales orders, so that I can record stock outflow and keep inventory accurate.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/sales` with a valid body, THE System SHALL create a Sale with its line items (Sale_Items) in a single database transaction and return it with HTTP 201.
2. THE System SHALL validate that every `product_item_id` in the sale line items belongs to the authenticated user's `companyId`.
3. WHEN the sale `status` is set to `COMPLETED` (on create or PATCH), THE System SHALL insert one Stock_Ledger record per Sale_Item with `movement_type = SALE` and a negative `quantity_change`.
4. IF the Stock_Level of any Product_Item would fall below zero after the sale, THEN THE System SHALL return HTTP 422 with a descriptive error identifying the under-stocked item.
5. IF a sale is set to `COMPLETED`, THEN THE System SHALL prevent changing its status back to `PENDING`.
6. WHEN a GET request is made to `/api/sales`, THE System SHALL return a paginated list of sales scoped to the authenticated user's `companyId`, ordered by `sale_date` descending.
7. WHEN a GET request is made to `/api/sales/[id]`, THE System SHALL return the sale with all its line items if it belongs to the authenticated user's `companyId`, or HTTP 404.
8. WHEN a PATCH request is made to `/api/sales/[id]` with status `CANCELLED`, THE System SHALL update the status; IF the sale was previously `COMPLETED`, THEN THE System SHALL insert reversal Stock_Ledger entries with positive `quantity_change`.
9. WHEN a DELETE request is made to `/api/sales/[id]`, THE System SHALL only allow deletion when the sale `status` is `PENDING`; IF the status is `COMPLETED` or `CANCELLED`, THEN THE System SHALL return HTTP 409.
10. IF the request body fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
11. WHILE a user's role is STAFF, THE System SHALL deny sale create, update, and delete operations with HTTP 403.

---

### Requirement 9: Inventory / Stock Tracking

**User Story:** As any authenticated user, I want to view the current stock level and movement history for each SKU, so that I can understand inventory at a glance.

#### Acceptance Criteria

1. THE System SHALL compute the Stock_Level for a Product_Item as the sum of all `quantity_change` values in the Stock_Ledger for that Product_Item.
2. WHEN a GET request is made to `/api/product-items/[id]`, THE System SHALL include the current `stockLevel` integer in the response.
3. WHEN a GET request is made to `/api/product-items`, THE System SHALL include the current `stockLevel` for each item in the list response.
4. WHEN a GET request is made to `/api/stock-ledger` with a `productItemId` query parameter, THE System SHALL return a paginated list of Stock_Ledger entries for that Product_Item scoped to the authenticated user's `companyId`.
5. IF the `productItemId` does not belong to the authenticated user's `companyId`, THEN THE System SHALL return HTTP 404.

---

### Requirement 10: Role-Based Access Control (RBAC)

**User Story:** As an OWNER, I want routes to enforce role restrictions, so that STAFF cannot modify critical data and MANAGER cannot manage users or company settings.

#### Acceptance Criteria

1. THE System SHALL define a reusable `requireRole` guard function that accepts one or more allowed roles and throws an error with HTTP 403 when the authenticated user's role is not in the allowed list.
2. WHEN `requireRole` is called with a role not held by the current user, THE System SHALL return a JSON response `{ success: false, message: "Forbidden" }` with HTTP 403.
3. THE System SHALL apply the following access rules:

   | Route group                      | Minimum role required |
   |----------------------------------|-----------------------|
   | Company PATCH                    | OWNER                 |
   | User create / update / delete    | OWNER                 |
   | Product create / update / delete | MANAGER               |
   | Product option create / update / delete | MANAGER        |
   | Product item update / delete     | MANAGER               |
   | Purchase create / update / delete | MANAGER              |
   | Sale create / update / delete    | MANAGER               |
   | All GET / read endpoints         | any authenticated user |

4. WHILE a user holds role SUPER_ADMIN, THE System SHALL grant access to all routes regardless of company scope.

---

### Requirement 11: Pagination

**User Story:** As any consumer of list endpoints, I want paginated responses, so that large data sets do not cause performance problems.

#### Acceptance Criteria

1. THE System SHALL accept `page` (integer ≥ 1, default 1) and `limit` (integer 1–100, default 20) query parameters on all list endpoints: `/api/products`, `/api/product-items`, `/api/categories`, `/api/users`, `/api/purchases`, `/api/sales`, `/api/stock-ledger`.
2. THE System SHALL return a `pagination` object in every list response containing: `page` (current page), `limit` (current limit), `total` (total matching records), and `totalPages` (total number of pages).
3. IF `page` or `limit` are provided but not valid integers within the allowed ranges, THEN THE System SHALL return HTTP 400 with a descriptive validation error.
4. THE System SHALL apply pagination at the database query level using `offset` and `limit`, not by slicing in-memory arrays.

---

### Requirement 12: Bug Fix — Categories GET Active Filter

**User Story:** As a frontend consumer, I want the categories list endpoint to return only active categories by default, so that soft-deleted categories do not appear in menus.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/categories` without an `includeInactive` query parameter, THE System SHALL filter results to only categories where `isActive = true`.
2. WHERE the `includeInactive=true` query parameter is provided, THE System SHALL return all categories regardless of `isActive`.
3. WHEN a GET request is made to `/api/categories/[id]`, THE System SHALL return the category regardless of its `isActive` state (for admin inspection).

---

### Requirement 13: Bug Fix — Product Options Slug Migration

**User Story:** As a developer, I want the `product_options` table to have its `slug` column present in the database, so that the schema and the ORM model stay consistent.

#### Acceptance Criteria

1. THE System SHALL include a migration SQL file that adds the `slug` column (varchar 100, not null with a default of `''` for existing rows) to the `product_options` table.
2. THE System SHALL include the corresponding Drizzle schema entry confirming `slug` is defined on the `productOptions` table (it already exists in the TypeScript schema — the migration must match it).
3. WHEN the Drizzle ORM queries `product_options`, THE System SHALL be able to read and write the `slug` column without error.
