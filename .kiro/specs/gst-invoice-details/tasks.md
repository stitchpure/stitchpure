# Implementation Plan: GST Invoice Details

## Overview

This plan implements GST-related fields across the application: shared GSTIN validation, database schema changes, validator updates, invoice service/PDF updates, and UI changes to company settings, sales form, and sales detail pages. Each task builds incrementally on the previous, starting with shared utilities and data layer, then services, then UI.

## Tasks

- [x] 1. Create shared utilities and update data layer
  - [x] 1.1 Create GSTIN utility module at `lib/gstin.ts`
    - Export `GSTIN_REGEX` constant with pattern `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
    - Export `GSTIN_ERROR_MESSAGE` string describing the expected format
    - Export `isValidGstin(value: string): boolean` function
    - _Requirements: 1.3, 1.4, 3.4, 3.5_

  - [x] 1.2 Create Indian states list at `lib/indian-states.ts`
    - Export `INDIAN_STATES` as a const array of all 28 states and 8 Union Territories
    - _Requirements: 4.3_

  - [x] 1.3 Update company schema at `db/schema/company.ts`
    - Add `gstin: varchar("gstin", { length: 15 })` field after `registeredAddress`
    - _Requirements: 1.1, 1.2_

  - [x] 1.4 Update sale schema at `db/schema/sale.ts`
    - Add `buyerGstin: varchar("buyer_gstin", { length: 15 })` after `buyerAddress`
    - Add `shippingAddress: text("shipping_address")` after `buyerGstin`
    - Add `placeOfSupply: varchar("place_of_supply", { length: 50 })` after `shippingAddress`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.5 Create database migration file `db/migrations/0012_gst_invoice_details.sql`
    - `ALTER TABLE companies ADD COLUMN gstin varchar(15) DEFAULT NULL;`
    - `ALTER TABLE sales ADD COLUMN buyer_gstin varchar(15) DEFAULT NULL;`
    - `ALTER TABLE sales ADD COLUMN shipping_address text DEFAULT NULL;`
    - `ALTER TABLE sales ADD COLUMN place_of_supply varchar(50) DEFAULT NULL;`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Update validators with GSTIN fields
  - [x] 2.1 Update company validator at `validators/company.validator.ts`
    - Import `GSTIN_REGEX` and `GSTIN_ERROR_MESSAGE` from `@/lib/gstin`
    - Add `gstin` field to `updateCompanySchema`: `z.string().length(15).regex(GSTIN_REGEX, GSTIN_ERROR_MESSAGE).nullable().optional()`
    - Update `UpdateCompanyInput` type export
    - _Requirements: 1.3, 1.4_

  - [x] 2.2 Update sale validator at `validators/sale.validator.ts`
    - Import `GSTIN_REGEX` and `GSTIN_ERROR_MESSAGE` from `@/lib/gstin`
    - Add `buyerGstin` field to `createSaleSchema`: `z.string().length(15).regex(GSTIN_REGEX, GSTIN_ERROR_MESSAGE).nullable().optional()`
    - Add `shippingAddress` field: `z.string().nullable().optional()`
    - Add `placeOfSupply` field: `z.string().max(50).nullable().optional()`
    - Update `CreateSaleInput` type export
    - _Requirements: 3.4, 3.5, 3.1, 3.2, 3.3_

  - [ ]* 2.3 Write property test for GSTIN validation (Property 1)
    - **Property 1: GSTIN validation accepts only correctly formatted values**
    - Create `__tests__/properties/gstin-validation.property.test.ts`
    - Use fast-check to generate arbitrary strings and verify `isValidGstin` accepts only strings matching the exact regex pattern
    - Minimum 100 iterations
    - **Validates: Requirements 1.3, 1.4, 3.4, 3.5**

  - [ ]* 2.4 Write property test for GSTIN round-trip through Zod (Property 2)
    - **Property 2: Valid GSTINs round-trip through Zod schema**
    - In `__tests__/properties/gstin-validation.property.test.ts`
    - Use fast-check to generate valid GSTIN strings, parse through both `updateCompanySchema` and `createSaleSchema`, and verify the value is unchanged
    - Minimum 100 iterations
    - **Validates: Requirements 1.3, 3.4**

- [x] 3. Checkpoint - Ensure data layer and validators are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update invoice service and PDF generation
  - [x] 4.1 Update invoice service at `services/invoice.service.ts`
    - Pass `company.gstin` as `sellerGstin` in `InvoiceData` (replace the hardcoded `null`)
    - Pass `sale.buyerGstin` as `buyerGstin` in `InvoiceData`
    - Pass `sale.shippingAddress` as `shippingAddress` in `InvoiceData`
    - Pass `sale.placeOfSupply` as `placeOfSupply` in `InvoiceData`
    - Remove the hardcoded `warnings.push("Seller GSTIN not configured")` line; only warn if `company.gstin` is null
    - _Requirements: 6.3, 7.1, 7.3, 7.4, 7.5_

  - [x] 4.2 Update invoice PDF service at `services/invoice-pdf.service.ts`
    - Add `shippingAddress: string | null` to `InvoiceData` interface
    - Add a "Ship To" section in the PDF layout that renders `shippingAddress` when present
    - When `shippingAddress` is null, use `buyerAddress` as fallback in the Ship To section
    - _Requirements: 7.4, 7.5, 7.6_

  - [ ]* 4.3 Write property test for shipping address fallback (Property 3)
    - **Property 3: Shipping address fallback to billing address**
    - Create test in `__tests__/properties/gstin-validation.property.test.ts` or a separate file
    - Use fast-check to generate InvoiceData objects and verify the Ship To section uses `shippingAddress` when present, otherwise uses `buyerAddress`
    - Minimum 100 iterations
    - **Validates: Requirements 7.4, 7.5**

  - [ ]* 4.4 Write unit tests for invoice service GST field assembly
    - Create/update `__tests__/unit/invoice-gst.test.ts`
    - Test that `company.gstin` maps to `sellerGstin`
    - Test that `sale.buyerGstin`, `sale.shippingAddress`, `sale.placeOfSupply` pass through correctly
    - Test warning is generated when `company.gstin` is null, not generated when present
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. Checkpoint - Ensure services and PDF logic are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update UI components
  - [x] 6.1 Update company settings page at `app/(dashboard)/company/page.tsx`
    - Add `gstin` to the `CompanyFormData` interface
    - Add a GSTIN input field after the Phone field in the form
    - Add client-side validation using `isValidGstin` from `@/lib/gstin` (allow empty)
    - Display validation error when format is invalid
    - Include `gstin` in the PATCH request payload
    - Populate field with existing value on page load
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 6.2 Update sales create form at `app/(dashboard)/sales/page.tsx`
    - Add `buyerGstin`, `shippingAddress`, `placeOfSupply` fields to the create sale form state
    - Add Buyer GSTIN input field with client-side GSTIN format validation (allow empty)
    - Add Shipping Address textarea field (optional)
    - Add Place of Supply `<select>` dropdown populated from `INDIAN_STATES` (allow empty selection)
    - Include all three fields in the sale creation POST request
    - Display validation error for invalid buyer GSTIN format
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.3 Update sales detail page to display GST fields
    - Display Buyer GSTIN when the sale has a `buyerGstin` value
    - Display Shipping Address separately from Billing Address when `shippingAddress` is present
    - When no shipping address, show billing address for both
    - Display Place of Supply when `placeOfSupply` is present
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [~] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript, Drizzle ORM, Zod, Vitest with fast-check
- Migration file number (0012) may need adjustment based on existing migrations at time of implementation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3"] }
  ]
}
```
