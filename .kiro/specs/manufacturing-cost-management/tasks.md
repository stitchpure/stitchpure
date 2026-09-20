# Implementation Plan: Manufacturing Cost Management

## Overview

This plan implements manufacturing cost management for the multi-tenant stock management SaaS. The implementation follows the established project architecture: Drizzle ORM schemas → Zod validators → service-layer business logic → Next.js App Router API routes → tests. Each step builds incrementally, ensuring no orphaned code.

## Tasks

- [ ] 1. Database schema and migrations
  - [x] 1.1 Create the production batch schema file
    - Create `db/schema/production-batch.ts` with the `productionBatchStatusEnum` and `productionBatches` table definition
    - Include all columns: id, companyId, batchNumber, productId, productItemId, startDate, completionDate, status, plannedQuantity, producedQuantity, goodQuantity, rejectedQuantity, all cost fields (materialCost through otherCost), totalManufacturingCost, costPerUnit, all per-category costPerUnit fields, createdAt, updatedAt
    - Add unique constraint on (companyId, batchNumber)
    - _Requirements: 18.1, 18.2, 18.6_

  - [x] 1.2 Create the expense schema file
    - Create `db/schema/expense.ts` with the `expenseCategoryEnum` and `expenses` table definition
    - Include all columns: id, companyId, category, name, amount, expenseDate, productionBatchId, productItemId, includeInManufacturingCost, notes, createdBy, createdAt, updatedAt
    - Reference `productionBatches` with onDelete SET NULL
    - _Requirements: 18.3, 18.6_

  - [x] 1.3 Create the product cost sheet schema file
    - Create `db/schema/product-cost-sheet.ts` with the `costSheetStatusEnum` and `productCostSheets` table definition
    - Include all columns: id, productId, productItemId, productionBatchId, effectiveDate, all per-unit cost fields, totalManufacturingCostPerUnit, status, createdAt, updatedAt
    - _Requirements: 18.4, 18.6_

  - [x] 1.4 Export new schemas from the schema index
    - Update `db/schema/index.ts` to export from `./production-batch`, `./expense`, and `./product-cost-sheet`
    - _Requirements: 18.8_

  - [x] 1.5 Generate and adjust the database migration file
    - Run `npx drizzle-kit generate` to produce the migration SQL
    - Verify migration creates enums before tables, creates `production_batches` before `expenses` and `product_cost_sheets`
    - Add the partial unique index on `product_cost_sheets` for `(product_id, product_item_id) WHERE status = 'ACTIVE'`
    - Ensure `-->  statement-breakpoint` separators are used between SQL statements
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

- [x] 2. Validators
  - [x] 2.1 Create expense validators
    - Create `validators/expense.validator.ts` with `createExpenseSchema` and `updateExpenseSchema`
    - Validate: name (1–255 chars), amount (numeric > 0), category (valid enum), expenseDate (ISO date string), productionBatchId (optional UUID), productItemId (optional UUID), includeInManufacturingCost (optional boolean), notes (optional string)
    - Update schema makes all fields optional
    - _Requirements: 14.1, 14.2, 14.3, 14.13, 14.16_

  - [x] 2.2 Create production batch validators
    - Create `validators/production-batch.validator.ts` with `createBatchSchema` and `updateBatchSchema`
    - Validate: productId (UUID), productItemId (optional UUID), startDate, plannedQuantity (integer ≥ 1), status (optional for create, required transition value for update)
    - Update schema: status (optional enum), producedQuantity (integer ≥ 0), goodQuantity (integer ≥ 0), rejectedQuantity (integer ≥ 0), completionDate (optional)
    - _Requirements: 15.1, 15.5, 15.15, 15.20_

  - [x] 2.3 Create product cost sheet validators
    - Create `validators/product-cost-sheet.validator.ts` with `createCostSheetSchema` and `updateCostSheetSchema`
    - Create schema: productionBatchId (UUID), effectiveDate (ISO date string)
    - Update schema: status (optional enum of DRAFT/ACTIVE/ARCHIVED), effectiveDate (optional); reject cost value fields
    - _Requirements: 17.1, 17.11, 17.13_

- [x] 3. Expense service and API routes
  - [x] 3.1 Implement the expense service
    - Create `services/expense.service.ts` with functions: createExpense, getExpenses, getExpenseById, updateExpense, deleteExpense
    - Implement company scoping on all queries
    - Validate productionBatchId and productItemId references belong to same company
    - Implement duplicate detection (same name + category on same batch → 409)
    - Hard delete for deleteExpense (return deleted record)
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 14.15_

  - [x] 3.2 Implement the expense API routes
    - Create `app/api/expenses/route.ts` with GET (list, paginated) and POST (create) handlers
    - Create `app/api/expenses/[id]/route.ts` with GET (by id), PATCH (update), DELETE handlers
    - Use authMiddleware, requireRole(MANAGER, OWNER) for write operations
    - Parse and validate request body with Zod schemas
    - Follow the existing handleError pattern from purchases route
    - _Requirements: 14.1, 14.7, 14.8, 14.9, 14.11, 14.13, 14.14_

  - [ ]* 3.3 Write property tests for expense service
    - **Property 1: Multi-Tenant Resource Isolation** — expenses from company A are not accessible by company B
    - **Property 2: RBAC Write Denial for STAFF** — STAFF can read but not write expenses
    - **Property 3: Invalid Input Rejection** — invalid expense data returns 400
    - **Property 9: Duplicate Expense Prevention on Batch** — same name+category on same batch returns 409
    - **Property 11: Partial Update Preserves Unchanged Fields** — PATCH only changes provided fields
    - **Validates: Requirements 14.4, 14.12, 14.13, 14.14, 14.15, 14.9**

  - [ ]* 3.4 Write unit tests for expense service
    - Test: default includeInManufacturingCost to true
    - Test: hard delete returns the deleted record
    - Test: amount validation rejects 0 and negative values
    - Test: pagination defaults and limits
    - _Requirements: 14.6, 14.11, 14.16, 14.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Production batch service and API routes
  - [x] 5.1 Implement the production batch service
    - Create `services/production-batch.service.ts` with functions: createBatch, getBatches, getBatchById, updateBatch, deleteBatch, getBatchExpenses, generateBatchNumber
    - Implement batch number generation (sequential per company, format BATCH-XXXX, inside transaction)
    - Implement state machine transitions (DRAFT→IN_PROGRESS, IN_PROGRESS→COMPLETED, IN_PROGRESS→CANCELLED)
    - On COMPLETED transition: aggregate expenses by category, compute totalManufacturingCost and costPerUnit, persist atomically
    - Validate producedQuantity = goodQuantity + rejectedQuantity when all three provided
    - Validate productId and productItemId references
    - Delete only DRAFT batches (409 otherwise)
    - Reject updates to COMPLETED/CANCELLED batches (409)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12, 15.17, 15.18, 15.19, 16.1, 16.2, 16.3, 16.6, 16.7_

  - [x] 5.2 Implement the production batch API routes
    - Create `app/api/production-batches/route.ts` with GET (list, paginated) and POST (create) handlers
    - Create `app/api/production-batches/[id]/route.ts` with GET (by id), PATCH (update), DELETE handlers
    - Create `app/api/production-batches/[id]/expenses/route.ts` with GET (list batch expenses, paginated)
    - Use authMiddleware, requireRole(MANAGER, OWNER) for write operations
    - Return null for costPerUnit fields on non-COMPLETED batches
    - _Requirements: 15.1, 15.7, 15.8, 15.9, 15.13, 15.14, 15.16, 16.4, 16.5_

  - [ ]* 5.3 Write property tests for production batch service
    - **Property 4: Cost Aggregation and Per-Unit Calculation** — completion correctly aggregates and divides
    - **Property 5: Terminal Batch Immutability** — COMPLETED/CANCELLED batches reject PATCH
    - **Property 7: State Machine Transition Validity** — only valid transitions permitted
    - **Property 8: Batch Number Sequential Uniqueness** — numbers always increment, unique per company
    - **Property 12: Quantity Cross-Field Validation** — producedQuantity = goodQuantity + rejectedQuantity
    - **Property 13: Batch Deletion Only in DRAFT** — non-DRAFT batches cannot be deleted
    - **Validates: Requirements 15.2, 15.6, 15.10, 15.11, 15.12, 15.17, 15.19, 16.1, 16.2, 16.3**

  - [ ]* 5.4 Write unit tests for production batch service
    - Test: batch number format "BATCH-0001" for first batch, incrementing for subsequent
    - Test: costPerUnit fields are null for non-COMPLETED batches
    - Test: goodQuantity=0 on completion returns 422
    - Test: cancelled batch expenses excluded from cost calculations
    - Test: atomic transaction rolls back on failure
    - _Requirements: 15.2, 15.18, 16.2, 16.4, 16.5, 16.7_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Product cost sheet service and API routes
  - [x] 7.1 Implement the product cost sheet service
    - Create `services/product-cost-sheet.service.ts` with functions: createCostSheet, getCostSheets, getCostSheetById, updateCostSheet
    - Derive productId, productItemId, and all cost values from the referenced completed batch
    - Reject creation from non-COMPLETED batches (422)
    - Implement one-active archival: when status set to ACTIVE, archive existing ACTIVE for same productId+productItemId in a transaction
    - Reject updates to cost value fields (400)
    - Company scoping via the referenced product's companyId
    - No delete functionality (405)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12, 17.15_

  - [x] 7.2 Implement the product cost sheet API routes
    - Create `app/api/product-cost-sheets/route.ts` with GET (list, paginated) and POST (create) handlers
    - Create `app/api/product-cost-sheets/[id]/route.ts` with GET (by id), PATCH (update), DELETE (returns 405)
    - Use authMiddleware, requireRole(MANAGER, OWNER) for write operations
    - _Requirements: 17.9, 17.10, 17.11, 17.13, 17.14, 17.15_

  - [ ]* 7.3 Write property tests for product cost sheet service
    - **Property 6: One-Active Cost Sheet Invariant** — at most one ACTIVE per productId+productItemId
    - **Property 10: Cost Sheet Derivation from Completed Batch** — derives values from completed batch; non-completed fails
    - **Property 14: Cost Sheet Field Immutability** — PATCH rejects cost value field updates
    - **Property 15: Archived Sheets Preservation** — archived count never decreases
    - **Validates: Requirements 17.1, 17.2, 17.6, 17.7, 17.8, 17.11, 17.12, 17.15**

  - [ ]* 7.4 Write unit tests for product cost sheet service
    - Test: creation from non-completed batch returns 422
    - Test: DELETE returns 405 Method Not Allowed
    - Test: activation archives the previous active sheet
    - Test: cost values correctly copied from batch
    - Test: pagination ordered by effectiveDate descending
    - _Requirements: 17.2, 17.6, 17.8, 17.9, 17.15_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, matching the existing codebase
- All services follow the established pattern: company-scoped queries, ServiceError for business logic errors, Drizzle transactions for atomicity

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 4, "tasks": ["3.1", "5.1"] },
    { "id": 5, "tasks": ["3.2", "5.2", "7.1"] },
    { "id": 6, "tasks": ["3.3", "3.4", "5.3", "5.4", "7.2"] },
    { "id": 7, "tasks": ["7.3", "7.4"] }
  ]
}
```
