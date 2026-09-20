# Requirements Document

## Introduction

This document defines requirements for adding Manufacturing Cost Management capabilities to the existing multi-tenant stock management SaaS application. The feature enables companies to track manufacturing expenses, manage production batches, calculate per-unit manufacturing costs, and maintain historical product cost sheets.

These requirements are additive (Requirements 14–17) and do not modify or conflict with existing Requirements 1–13 defined in the stock-management-backend-completion spec.

---

## Glossary

- **System**: The stock management SaaS backend application
- **Expense**: A financial outflow associated with manufacturing activities, categorized by type (Material, Labour, Packaging, Overhead, Transport, Other)
- **Expense_Category**: An enumeration of expense types: MATERIAL, LABOUR, PACKAGING, OVERHEAD, TRANSPORT, OTHER
- **Production_Batch**: A single manufacturing cycle that transforms inputs into finished goods, tracking quantities and costs
- **Batch_Status**: The lifecycle state of a Production_Batch: DRAFT, IN_PROGRESS, COMPLETED, CANCELLED
- **Good_Quantity**: The number of units produced that passed quality checks within a Production_Batch
- **Rejected_Quantity**: The number of units produced that failed quality checks within a Production_Batch
- **Total_Manufacturing_Cost**: The sum of all eligible expenses (where includeInManufacturingCost is true) assigned to a Production_Batch
- **Cost_Per_Unit**: Total_Manufacturing_Cost divided by Good_Quantity for a completed Production_Batch
- **Product_Cost_Sheet**: A record summarizing the per-unit manufacturing cost breakdown for a Product or SKU, derived from a completed Production_Batch
- **Cost_Sheet_Status**: The lifecycle state of a Product_Cost_Sheet: DRAFT, ACTIVE, ARCHIVED
- **Company**: The multi-tenant root entity owning all data (existing)
- **Product**: A named, catalogued item belonging to a company (existing)
- **Product_Item**: A sellable SKU/variant belonging to a Product (existing)
- **authMiddleware**: The existing JWT verification middleware (existing)
- **AuthUser**: The decoded JWT payload containing userId, companyId, and role (existing)

---

## Requirements

---

### Requirement 14: Manufacturing Expenses Management

**User Story:** As a MANAGER or OWNER, I want to create and manage manufacturing expenses, so that I can track all costs associated with production.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/expenses` with a valid body containing at minimum: name (varchar, 1–255 characters), amount (numeric > 0), category (valid Expense_Category), and expenseDate, THE System SHALL create a new Expense scoped to the authenticated user's companyId, set createdBy to the authenticated userId, and return the Expense with HTTP 201.
2. THE System SHALL store Expense amounts using numeric precision 14 and scale 2, accepting values in the range 0.01 to 99999999999999.99.
3. THE System SHALL validate that the Expense_Category value is one of: MATERIAL, LABOUR, PACKAGING, OVERHEAD, TRANSPORT, OTHER.
4. WHEN an Expense includes a productionBatchId, THE System SHALL validate that the referenced Production_Batch exists and belongs to the authenticated user's companyId.
5. WHEN an Expense includes a productItemId, THE System SHALL validate that the referenced Product_Item belongs to the authenticated user's companyId.
6. THE System SHALL default the includeInManufacturingCost field to true when not explicitly provided.
7. WHEN a GET request is made to `/api/expenses`, THE System SHALL return a paginated list of expenses scoped to the authenticated user's companyId, ordered by expenseDate descending, using query parameters page (default 1, minimum 1) and limit (default 20, range 1–100).
8. WHEN a GET request is made to `/api/expenses/[id]`, THE System SHALL return the Expense if it belongs to the authenticated user's companyId, or HTTP 404 if not found.
9. WHEN a PATCH request is made to `/api/expenses/[id]` with a valid body, THE System SHALL update only the provided fields and return the updated Expense with HTTP 200.
10. IF an Expense update changes the productionBatchId to a Production_Batch that belongs to a different companyId, THEN THE System SHALL return HTTP 404.
11. WHEN a DELETE request is made to `/api/expenses/[id]`, THE System SHALL permanently delete the Expense and return HTTP 200 with the deleted record.
12. IF the target Expense for a GET by id, PATCH, or DELETE operation does not belong to the authenticated user's companyId, THEN THE System SHALL return HTTP 404.
13. IF the request body for Expense create or update fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
14. WHILE a user's role is STAFF, THE System SHALL deny Expense create, update, and delete operations with HTTP 403, but SHALL allow read (GET list and GET by id) operations.
15. IF an Expense is assigned to a Production_Batch that already includes an Expense with the same name and Expense_Category, THEN THE System SHALL return HTTP 409 to prevent duplicate allocation.
16. IF the amount field in an Expense create or update request is zero or negative, THEN THE System SHALL return HTTP 400 with a validation error indicating amount must be greater than zero.

---

### Requirement 15: Production Batch Management

**User Story:** As a MANAGER or OWNER, I want to create and manage production batches, so that I can track manufacturing cycles and associate costs with production runs.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/production-batches` with a valid body containing at minimum productId, startDate, and plannedQuantity, THE System SHALL create a new Production_Batch scoped to the authenticated user's companyId with status set to DRAFT and return it with HTTP 201.
2. THE System SHALL generate the batchNumber as unique per companyId using a zero-padded sequential format prefixed with "BATCH-" (e.g., "BATCH-0001", "BATCH-0002"), incrementing from the highest existing batchNumber for that companyId.
3. THE System SHALL validate that the referenced productId exists and belongs to the authenticated user's companyId; IF the productId does not exist or belongs to a different company, THEN THE System SHALL return HTTP 400 with a message indicating the product reference is invalid.
4. WHEN a productItemId is provided, THE System SHALL validate that the referenced Product_Item belongs to the specified productId; IF the Product_Item does not belong to the specified productId, THEN THE System SHALL return HTTP 400 with a message indicating the product item reference is invalid.
5. THE System SHALL store all cost fields (materialCost, labourCost, packagingCost, overheadCost, transportCost, otherCost, totalManufacturingCost) using numeric precision 14 and scale 2, defaulting to 0.00, with a valid range of 0.00 to 99999999999999.99.
6. THE System SHALL validate that producedQuantity equals the sum of goodQuantity and rejectedQuantity when all three fields are provided; IF only a subset of producedQuantity, goodQuantity, and rejectedQuantity is provided, THE System SHALL accept the update without cross-field validation.
7. WHEN a GET request is made to `/api/production-batches`, THE System SHALL return a paginated list of Production_Batches scoped to the authenticated user's companyId, ordered by startDate descending, with a default page size of 20 and a maximum page size of 100.
8. WHEN a GET request is made to `/api/production-batches/[id]`, THE System SHALL return the Production_Batch if it belongs to the authenticated user's companyId, or HTTP 404 if not found.
9. WHEN a PATCH request is made to `/api/production-batches/[id]` with a valid body, THE System SHALL update only the provided fields and return the updated Production_Batch.
10. IF a Production_Batch has status COMPLETED, THEN THE System SHALL reject any PATCH request with HTTP 409 and a message indicating completed batches are read-only.
11. IF a Production_Batch has status CANCELLED, THEN THE System SHALL reject any PATCH request with HTTP 409 and a message indicating cancelled batches are read-only.
12. WHEN a Production_Batch status transitions to COMPLETED, THE System SHALL compute the totalManufacturingCost by summing all associated Expenses where includeInManufacturingCost is true, mapping Expense_Category MATERIAL to materialCost, LABOUR to labourCost, PACKAGING to packagingCost, OVERHEAD to overheadCost, TRANSPORT to transportCost, and OTHER to otherCost.
13. WHEN a GET request is made to `/api/production-batches/[id]/expenses`, THE System SHALL return a paginated list of Expenses assigned to the specified Production_Batch, with a default page size of 20 and a maximum page size of 100.
14. IF the target Production_Batch does not belong to the authenticated user's companyId, THEN THE System SHALL return HTTP 404.
15. IF the request body for Production_Batch create or update fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
16. WHILE a user's role is STAFF, THE System SHALL deny Production_Batch create, update, and delete operations with HTTP 403.
17. WHEN a DELETE request is made to `/api/production-batches/[id]`, THE System SHALL only allow deletion when the Production_Batch status is DRAFT; IF the status is IN_PROGRESS, COMPLETED, or CANCELLED, THEN THE System SHALL return HTTP 409 with a message indicating the batch cannot be deleted in its current status.
18. WHEN a Production_Batch has status CANCELLED, THE System SHALL exclude all Expenses associated with that batch from any cost calculations.
19. THE System SHALL only allow the following status transitions: DRAFT to IN_PROGRESS, IN_PROGRESS to COMPLETED, IN_PROGRESS to CANCELLED; IF a PATCH request attempts an invalid status transition, THEN THE System SHALL return HTTP 422 with a message indicating the transition is not permitted.
20. THE System SHALL validate that plannedQuantity is an integer greater than or equal to 1, and that producedQuantity, goodQuantity, and rejectedQuantity are integers greater than or equal to 0.

---

### Requirement 16: Cost Per Unit Calculation

**User Story:** As a MANAGER or OWNER, I want the system to automatically calculate manufacturing cost per unit, so that I can understand the true cost of producing each item.

#### Acceptance Criteria

1. WHEN a Production_Batch status transitions to COMPLETED, THE System SHALL calculate costPerUnit as totalManufacturingCost divided by goodQuantity, and calculate per-category cost per unit values (materialCostPerUnit, labourCostPerUnit, packagingCostPerUnit, overheadCostPerUnit, transportCostPerUnit, otherCostPerUnit) each computed as the respective category cost divided by goodQuantity, storing all results rounded to 4 decimal places.
2. IF goodQuantity is zero at the time of completing a Production_Batch, THEN THE System SHALL reject the status transition, keep the batch in its current status, and return HTTP 422 with a message indicating that good quantity must be greater than zero for cost calculation.
3. THE System SHALL use rejectedQuantity only for producedQuantity validation and exclude rejected units from all cost-per-unit calculations.
4. WHEN a GET request is made to `/api/production-batches/[id]` for a COMPLETED batch, THE System SHALL include costPerUnit and all per-category cost per unit values in the response.
5. WHEN a GET request is made to `/api/production-batches/[id]` for a non-COMPLETED batch, THE System SHALL return null for costPerUnit and all per-category cost per unit fields.
6. THE System SHALL store cost per unit values using numeric precision 14 and scale 4.
7. WHEN a Production_Batch status transitions to COMPLETED, THE System SHALL persist the cost per unit values and the status change within a single atomic transaction, ensuring either all values are stored and status is updated, or none are.

---

### Requirement 17: Product Cost Sheet Management

**User Story:** As a MANAGER or OWNER, I want to generate and manage product cost sheets, so that I can maintain a historical record of manufacturing costs per product or SKU.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/product-cost-sheets` with a valid body containing productionBatchId and effectiveDate, THE System SHALL derive productId and productItemId from the referenced Production_Batch, create a new Product_Cost_Sheet with status DRAFT populated with cost per unit values from the referenced batch, and return it with HTTP 201.
2. IF the referenced Production_Batch does not have status COMPLETED, THEN THE System SHALL return HTTP 422 with a message indicating that cost sheets can only be generated from completed batches.
3. IF the referenced productionBatchId does not exist, THEN THE System SHALL return HTTP 400 with a message indicating the production batch reference is invalid.
4. IF the referenced Production_Batch does not belong to the authenticated user's companyId, THEN THE System SHALL return HTTP 404.
5. THE System SHALL store all per-unit cost fields on the Product_Cost_Sheet using numeric precision 14 and scale 4.
6. WHEN a Product_Cost_Sheet status is set to ACTIVE, THE System SHALL archive any existing ACTIVE Product_Cost_Sheet for the same productId and productItemId combination by setting the previous sheet's status to ARCHIVED.
7. THE System SHALL enforce that only one Product_Cost_Sheet with status ACTIVE exists per unique productId and productItemId combination at any time.
8. THE System SHALL preserve all historical Product_Cost_Sheets with status ARCHIVED and never delete them.
9. WHEN a GET request is made to `/api/product-cost-sheets`, THE System SHALL return a paginated list of Product_Cost_Sheets scoped to the authenticated user's companyId, ordered by effectiveDate descending.
10. WHEN a GET request is made to `/api/product-cost-sheets/[id]`, THE System SHALL return the Product_Cost_Sheet if it belongs to the authenticated user's companyId (via the referenced Product), or HTTP 404 if not found.
11. WHEN a PATCH request is made to `/api/product-cost-sheets/[id]` with a valid body, THE System SHALL update only the status and effectiveDate fields; THE System SHALL reject updates to cost values (materialCostPerUnit, labourCostPerUnit, packagingCostPerUnit, overheadCostPerUnit, transportCostPerUnit, otherCostPerUnit, totalManufacturingCostPerUnit) with HTTP 400.
12. IF a PATCH request attempts to set status to ACTIVE on a Product_Cost_Sheet, THE System SHALL archive any existing ACTIVE sheet for the same productId and productItemId combination.
13. IF the request body for Product_Cost_Sheet create or update fails Zod validation, THEN THE System SHALL return HTTP 400 with field-level validation errors.
14. WHILE a user's role is STAFF, THE System SHALL deny Product_Cost_Sheet create and update operations with HTTP 403.
15. THE System SHALL NOT allow deletion of Product_Cost_Sheets to preserve cost history; DELETE requests to `/api/product-cost-sheets/[id]` SHALL return HTTP 405.

---

### Requirement 18: Manufacturing Cost Database Migrations

**User Story:** As a developer, I want DB migration SQL files for all new manufacturing cost tables, so that the database schema stays in sync with the application code.

#### Acceptance Criteria

1. THE System SHALL include a migration that creates the `production_batches` table before any table that references it, with columns: `id` (UUID PK), `company_id` (UUID FK → companies, CASCADE, not null), `batch_number` (varchar 50, not null), `product_id` (UUID FK → products, RESTRICT, not null), `product_item_id` (UUID FK → product_items, SET NULL, nullable), `start_date` (timestamp, not null), `completion_date` (timestamp, nullable), `status` (enum: DRAFT/IN_PROGRESS/COMPLETED/CANCELLED, default DRAFT, not null), `planned_quantity` (integer, not null), `produced_quantity` (integer, default 0, not null), `good_quantity` (integer, default 0, not null), `rejected_quantity` (integer, default 0, not null), `material_cost` (numeric 14,2, default 0, not null), `labour_cost` (numeric 14,2, default 0, not null), `packaging_cost` (numeric 14,2, default 0, not null), `overhead_cost` (numeric 14,2, default 0, not null), `transport_cost` (numeric 14,2, default 0, not null), `other_cost` (numeric 14,2, default 0, not null), `total_manufacturing_cost` (numeric 14,2, default 0, not null), `cost_per_unit` (numeric 14,4, nullable), `material_cost_per_unit` (numeric 14,4, nullable), `labour_cost_per_unit` (numeric 14,4, nullable), `packaging_cost_per_unit` (numeric 14,4, nullable), `overhead_cost_per_unit` (numeric 14,4, nullable), `transport_cost_per_unit` (numeric 14,4, nullable), `other_cost_per_unit` (numeric 14,4, nullable), `created_at` (timestamp, default now, not null), `updated_at` (timestamp, default now, not null).
2. THE System SHALL include a unique constraint on `production_batches` for the combination of `company_id` and `batch_number`.
3. THE System SHALL include a migration that creates the `expenses` table after the `production_batches` table exists, with columns: `id` (UUID PK), `company_id` (UUID FK → companies, CASCADE, not null), `category` (enum: MATERIAL/LABOUR/PACKAGING/OVERHEAD/TRANSPORT/OTHER, not null), `name` (varchar 255, not null), `amount` (numeric 14,2, not null), `expense_date` (timestamp, not null), `production_batch_id` (UUID FK → production_batches, SET NULL, nullable), `product_item_id` (UUID FK → product_items, SET NULL, nullable), `include_in_manufacturing_cost` (boolean, default true, not null), `notes` (text, nullable), `created_by` (UUID FK → users, SET NULL, not null), `created_at` (timestamp, default now, not null), `updated_at` (timestamp, default now, not null).
4. THE System SHALL include a migration that creates the `product_cost_sheets` table after the `production_batches` table exists, with columns: `id` (UUID PK), `product_id` (UUID FK → products, RESTRICT, not null), `product_item_id` (UUID FK → product_items, SET NULL, nullable), `production_batch_id` (UUID FK → production_batches, RESTRICT, not null), `effective_date` (timestamp, not null), `material_cost_per_unit` (numeric 14,4, not null), `labour_cost_per_unit` (numeric 14,4, not null), `packaging_cost_per_unit` (numeric 14,4, not null), `overhead_cost_per_unit` (numeric 14,4, not null), `transport_cost_per_unit` (numeric 14,4, not null), `other_cost_per_unit` (numeric 14,4, not null), `total_manufacturing_cost_per_unit` (numeric 14,4, not null), `status` (enum: DRAFT/ACTIVE/ARCHIVED, default DRAFT, not null), `created_at` (timestamp, default now, not null), `updated_at` (timestamp, default now, not null).
5. THE System SHALL include a partial unique index on `product_cost_sheets` enforcing only one ACTIVE record per `product_id` and `product_item_id` combination WHERE `status` = 'ACTIVE'.
6. THE System SHALL create PostgreSQL enum types (`expense_category`, `production_batch_status`, `cost_sheet_status`) before referencing them in table column definitions.
7. THE System SHALL format migration files using Drizzle Kit conventions with `--> statement-breakpoint` separators between SQL statements.
8. THE System SHALL NOT modify any existing tables or drop any existing columns in these migrations.

---

## New Tables Justification

1. **expenses** — No existing table tracks general business expenses. Cannot reuse `purchases` (which tracks stock intake from suppliers). Expenses represent a distinct financial concept covering labour, overhead, packaging, transport, and other non-inventory costs.
2. **production_batches** — No existing table tracks manufacturing cycles. Purchases track supplier orders, not internal production runs. Production batches need lifecycle states, quantity tracking, and cost aggregation which are fundamentally different from purchase orders.
3. **product_cost_sheets** — No existing table stores per-unit cost breakdowns. The `product_items` table has `purchasePrice` and `sellingPrice` but does not capture manufacturing cost details with category-level granularity or historical versioning.
