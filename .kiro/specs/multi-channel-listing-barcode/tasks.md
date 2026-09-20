# Implementation Plan: Multi-Channel Listing & Barcode Management

## Overview

This plan implements multi-channel listing management, barcode label generation/scanning, and returns processing. Tasks are organized to build data layer first (schema + migrations), then services, API routes, and finally UI pages with barcode integration.

## Tasks

- [x] 1. Database schema and migration setup
  - [x] 1.1 Create the `listings` table schema and channel enum
    - Create `db/schema/listing.ts` with the `channelEnum` and `listings` pgTable definition
    - Export the `listings` table and `channelEnum`
    - Include all fields: id, company_id, product_item_id, channel, title, listing_price, platform_sku, listing_url, is_active, created_at, updated_at
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Extend the `sales` table schema with channel, listing, and return fields
    - Add `channel` (varchar 50, nullable), `listingId` (uuid FK to listings, nullable, onDelete set null), `returnStatus` (varchar 20, nullable), `returnReason` (varchar 50, nullable), `returnCondition` (varchar 50, nullable), `returnedAt` (timestamp, nullable) columns to `db/schema/sale.ts`
    - Import listings reference for the FK
    - _Requirements: 3.1, 11.4_

  - [x] 1.3 Extend the `stock_ledger` movement_type enum with RETURN value
    - Update `movementTypeEnum` in `db/schema/stock-ledger.ts` to include "RETURN"
    - _Requirements: 16.3_

  - [x] 1.4 Create the database migration file
    - Generate or write a SQL migration that creates the `listings` table, adds new columns to `sales`, and alters the `movement_type` enum to include RETURN
    - Place at `db/migrations/XXXX_multi_channel_listing_barcode.sql`
    - _Requirements: 1.1, 3.1, 11.4, 16.3_

  - [x] 1.5 Register schema exports in the schema index
    - Export listings schema from the schema barrel file (e.g., `db/schema/index.ts`)
    - _Requirements: 1.1_

- [x] 2. Validators for listings and returns
  - [x] 2.1 Create `validators/listing.validator.ts`
    - Implement `createListingSchema` with productItemId (uuid), channel (enum), title (min 1, max 300), listingPrice (coerce number, min 0), platformSku (optional, max 150), listingUrl (optional, url, max 500)
    - Implement `updateListingSchema` with all fields optional
    - _Requirements: 1.1, 1.2, 2.3_

  - [x] 2.2 Create `validators/return.validator.ts`
    - Implement `processReturnSchema` with returnReason (enum: Size_Issue, Damaged_In_Transit, Changed_Mind, Wrong_Product_Shipped), returnCondition (enum: Good, Damaged, Wrong_Product), scannedSku (optional string)
    - _Requirements: 13.1, 13.5_

  - [ ]* 2.3 Write property tests for channel and return validators
    - **Property 1: Channel validation rejects invalid values**
    - **Property 19: Return reason validation**
    - **Validates: Requirements 1.2, 13.5**
    - Test file: `__tests__/properties/listing-barcode.property.test.ts`

- [x] 3. Listing service implementation
  - [x] 3.1 Create `services/listing.service.ts` with CRUD operations
    - Implement `createListing(companyId, data)` — validate product ownership, insert listing, return created record
    - Implement `getListings(companyId, params, filters)` — paginated query with optional channel, productItemId, isActive filters
    - Implement `getListingById(companyId, id)` — fetch single listing with ownership check
    - Implement `updateListing(companyId, id, data)` — partial update with ownership check
    - Implement `deactivateListing(companyId, id)` — set is_active to false
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Implement `getListingPerformance` in the listing service
    - Query sales by listing_id, compute total_orders, total_returns, return_rate, total_revenue, profit
    - Profit = SUM(total_amount) - SUM(product cost × quantity) using joined cost data
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 3.3 Write property tests for listing logic
    - **Property 2: Listing creation populates all fields with is_active defaulting to true**
    - **Property 3: Multiple listings per product coexist**
    - **Property 4: Company ownership validation for listings**
    - **Property 5: Channel filter returns only matching listings**
    - **Property 6: Product filter returns only matching listings**
    - **Property 7: Listing update persists correctly**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.6, 2.2, 2.3, 2.5**

  - [ ]* 3.4 Write property test for listing performance metrics
    - **Property 9: Listing performance metrics accuracy**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [x] 4. Return service implementation
  - [x] 4.1 Create `services/return.service.ts` with return processing
    - Implement `processReturn(companyId, saleId, data)` — validate sale is COMPLETED & not already returned, verify scanned SKU against sale items, update sale record with return fields, conditionally create stock_ledger RETURN entry (only for Good condition)
    - Use a database transaction to ensure atomicity
    - _Requirements: 11.1, 11.2, 11.3, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 16.1, 16.2, 16.4_

  - [x] 4.2 Implement `getReturnReport` in the return service
    - Query sales grouped by listing_id, compute return count, return rate, breakdown by return_reason and return_condition
    - Sort by return_rate descending by default
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 4.3 Write property tests for return processing
    - **Property 16: Good-condition return restores stock**
    - **Property 17: Damaged/Wrong_Product returns do not add stock**
    - **Property 18: Return processing updates sale record completely**
    - **Property 20: Return report sorting**
    - **Validates: Requirements 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 15.4, 16.1, 16.2, 16.4**

- [x] 5. Checkpoint - Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API routes for listings
  - [x] 6.1 Create `app/api/listings/route.ts` (GET list + POST create)
    - GET: parse query params (page, limit, channel, productItemId, isActive), call `getListings`, return paginated response
    - POST: validate body with `createListingSchema`, call `createListing`, return 201
    - Auth middleware extracts companyId from session
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2_

  - [x] 6.2 Create `app/api/listings/[id]/route.ts` (GET, PUT, DELETE)
    - GET: call `getListingById`, return listing or 404
    - PUT: validate body with `updateListingSchema`, call `updateListing`
    - DELETE: call `deactivateListing` (soft-delete sets is_active false)
    - _Requirements: 2.3, 2.4_

  - [x] 6.3 Create `app/api/listings/[id]/performance/route.ts` (GET)
    - Call `getListingPerformance`, return metrics
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. API routes for returns
  - [x] 7.1 Create `app/api/returns/[saleId]/route.ts` (POST)
    - Validate body with `processReturnSchema`, call `processReturn`, return updated sale
    - Handle 409 for already-returned sales, 404 for unknown sale
    - _Requirements: 11.3, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3_

  - [x] 7.2 Create `app/api/returns/report/route.ts` (GET)
    - Call `getReturnReport`, return listing-wise return rate data
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 8. API route for SKU lookup
  - [x] 8.1 Create `app/api/product-items/sku/[sku]/route.ts` (GET)
    - Look up product item by SKU, return product item details with product name, variant info, and current stock level
    - Return 404 if SKU not found
    - _Requirements: 7.3, 7.4_

  - [ ]* 8.2 Write property test for SKU lookup round-trip
    - **Property 12: SKU lookup round-trip**
    - **Validates: Requirements 7.3, 7.4**

- [x] 9. Extend sale creation API with listing association
  - [x] 9.1 Modify `app/api/sales` POST route to accept channel and listing_id
    - Update sale creation to accept optional `channel` and `listingId` fields
    - Validate listing_id belongs to same company if provided
    - Allow null listing_id for backward compatibility
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 9.2 Write property test for sale-listing validation
    - **Property 8: Sale-listing validation**
    - **Validates: Requirements 3.2**

- [x] 10. Checkpoint - API layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Client-side barcode generation library
  - [x] 11.1 Create `lib/barcode.ts` with label generation utilities
    - Implement `generateBarcodeDataUrl(sku)` using JsBarcode to render Code-128 barcode as data URL
    - Implement `generateLabelHtml(data: LabelData)` producing a 50mm × 25mm label with barcode, SKU text, product name, and variant info (no price)
    - Implement `generateBatchLabelsHtml(items: LabelData[])` producing multiple labels in a printable layout
    - Implement `triggerPrint(html)` opening browser print dialog with CSS print media queries for thermal printer dimensions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3_

  - [ ]* 11.2 Write property tests for barcode label generation
    - **Property 10: Barcode label contains required info and excludes price**
    - **Property 11: Batch label generation produces correct count**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.7**

- [x] 12. Barcode scanner component
  - [x] 12.1 Create `components/barcode-scanner.tsx` using html5-qrcode
    - Implement camera activation with permission request
    - Handle barcode detection (Code-128), extract decoded SKU value
    - Call SKU lookup API on successful scan
    - Provide visual feedback (green flash) and audio feedback (beep) on success
    - Show error states: camera denied, SKU not found, no barcode detected
    - Expose `onScanSuccess(productItem)` and `onScanError(error)` callbacks
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 13. Listings management UI page
  - [x] 13.1 Create `app/(dashboard)/listings/page.tsx`
    - Render paginated table of listings with columns: title, channel, price, platform SKU, status (active/inactive)
    - Add channel filter dropdown and product filter
    - Add "Create Listing" button opening a create/edit modal
    - Modal uses `createListingSchema` for client-side validation
    - Include product item selector (dropdown of existing items)
    - Support inline deactivate action per row
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 13.2 Add listing performance view
    - Show performance metrics (total orders, returns, return rate, revenue, profit) on listing detail or expandable row
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 14. Barcode labels UI page
  - [x] 14.1 Create `app/(dashboard)/barcode-labels/page.tsx`
    - Product item selector (multi-select) to choose items for label generation
    - Preview panel showing rendered labels at thermal printer dimensions (50mm × 25mm)
    - "Print Labels" button triggering browser print dialog with appropriate CSS
    - Batch quantity input to generate multiple labels per item
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3_

- [x] 15. Barcode-assisted sale creation
  - [x] 15.1 Enhance the sale creation form with barcode scanner integration
    - Add "Scan Barcode" button that activates the BarcodeScanner component
    - On successful scan, auto-fill product item field with matched product_item_id
    - Display product name, variant, and current stock for confirmation
    - Support consecutive scans to add multiple line items
    - Add channel and listing_id selector fields to the sale form
    - _Requirements: 8.1, 8.2, 8.3, 3.1, 3.2, 3.3_

- [x] 16. Packing verification UI
  - [x] 16.1 Create packing verification component/mode in sales detail
    - Display list of expected items from the sale (SKU, product name, quantity)
    - Activate barcode scanner; on scan, match SKU against expected items
    - Mark verified items with green checkmark
    - Show mismatch warning for unexpected SKUs
    - Show completion confirmation when all items verified
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 16.2 Write property tests for packing verification logic
    - **Property 13: Packing verification match/mismatch**
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 17. Stock counting UI page
  - [x] 17.1 Create `app/(dashboard)/stock-count/page.tsx`
    - "Start Counting" button initializes a client-side counting session
    - Barcode scanner for scanning items; each scan increments SKU count
    - Display running count table (SKU, product name, counted qty, system stock qty)
    - "Complete" button shows comparison view highlighting discrepancies
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 17.2 Write property tests for stock counting logic
    - **Property 14: Stock counting increment**
    - **Property 15: Discrepancy detection**
    - **Validates: Requirements 10.1, 10.2, 10.4**

- [x] 18. Return processing UI
  - [x] 18.1 Add return processing flow to sale detail page
    - Show "Process Return" button on COMPLETED sales (hidden on PENDING/CANCELLED)
    - Hide button if return_status is already "RETURNED"
    - On click, activate barcode scanner for return verification
    - Compare scanned SKU against sale items; proceed to condition selection on match
    - On mismatch, show error with "Re-scan" or "Wrong Product" options
    - Condition selection: Good, Damaged, Wrong_Product radio buttons
    - Reason selection: Size_Issue, Damaged_In_Transit, Changed_Mind, Wrong_Product_Shipped dropdown
    - Submit calls POST `/api/returns/{saleId}`
    - _Requirements: 11.1, 11.2, 11.3, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3_

- [x] 19. Return rate report UI
  - [x] 19.1 Create return rate report view (within listings or a dedicated page)
    - Display listing-wise return rates in a table sorted by return rate descending
    - Show breakdown by return_reason and return_condition per listing
    - Include totals row
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 20. Sales list filtering by return status
  - [x] 20.1 Add return_status filter to the sales list page
    - Add filter option to view all returned orders (return_status = "RETURNED")
    - Display return info columns (return_status, return_reason, return_condition, returned_at) in the sales table
    - _Requirements: 14.4_

- [x] 21. Final checkpoint - Full feature integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Barcode generation (JsBarcode) and scanning (html5-qrcode) are client-side only — no server-side image processing needed
- The stock_ledger enum migration requires a PostgreSQL ALTER TYPE statement
- All API routes follow existing auth middleware pattern extracting companyId from session

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "2.3"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "4.3"] },
    { "id": 4, "tasks": ["3.4", "6.1", "7.1", "8.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.2", "8.2", "9.1"] },
    { "id": 6, "tasks": ["9.2", "11.1"] },
    { "id": 7, "tasks": ["11.2", "12.1"] },
    { "id": 8, "tasks": ["13.1", "14.1", "15.1"] },
    { "id": 9, "tasks": ["13.2", "16.1", "17.1", "18.1"] },
    { "id": 10, "tasks": ["16.2", "17.2", "19.1", "20.1"] }
  ]
}
```
