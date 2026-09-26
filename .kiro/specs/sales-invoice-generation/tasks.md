# Implementation Plan: Sales Invoice Generation

## Overview

Implement GST-compliant tax invoice PDF generation from sales records. The implementation follows a bottom-up approach: pure utility libraries first, then database schema, services, API routes, and finally integration wiring. TypeScript throughout with Drizzle ORM, pdf-lib for PDF, qrcode for QR, and jszip for bulk ZIP.

## Tasks

- [x] 1. Install dependency and set up database schema
  - [x] 1.1 Install qrcode package and types
    - Run `npm install qrcode` and `npm install -D @types/qrcode`
    - Verify package.json updated with qrcode dependency
    - _Requirements: 5.1, 5.3_

  - [x] 1.2 Create invoice-related database schema files
    - Create `db/schema/invoice.ts` with `invoices` table (id, companyId, saleId unique, invoiceNumber, financialYear, sequenceNumber, status enum ACTIVE/CANCELLED, generatedAt, timestamps)
    - Create `db/schema/invoice-number-sequence.ts` with `invoiceNumberSequences` table (id, companyId, financialYear, lastSequence, timestamps) with unique constraint on (companyId, financialYear)
    - Create `db/schema/invoice-template.ts` with `invoiceTemplates` table (id, companyId unique, headerColor, accentColor, font, termsAndConditions, bankDetails, timestamps)
    - Export all new schemas from `db/schema/index.ts`
    - _Requirements: 1.7, 9.7, 11.1_

  - [x] 1.3 Extend existing sales and companies schemas
    - Add `buyerAddress: text("buyer_address")` column to sales table in `db/schema/sale.ts`
    - Add `registeredAddress: text("registered_address")` column to companies table in `db/schema/company.ts`
    - _Requirements: 2.1, 10.1_

  - [x] 1.4 Generate and apply database migration
    - Run `npm run db:generate` to create migration SQL for all schema changes
    - Verify migration file includes all 3 new tables and 2 column additions
    - _Requirements: 1.7, 9.7, 10.1, 11.1_

- [x] 2. Implement pure utility libraries
  - [x] 2.1 Create `lib/invoice-utils.ts` with all pure utility functions
    - Implement `getFinancialYear(date: Date): string` — April-March cycle, returns "YY-YY" format
    - Implement `formatInvoiceNumber(financialYear: string, sequence: number): string` — returns "INV/{fy}/{0001}" pattern
    - Implement `invoiceNumberToFilename(invoiceNumber: string): string` — replaces "/" with "-", appends ".pdf"
    - Implement `formatAddress(address: string): string[]` — splits on commas/newlines, trims each line
    - Implement `scaleLogo(originalWidth, originalHeight, maxWidth, maxHeight): { width, height }` — aspect-ratio-preserving scale
    - Implement `getTaxColumnVisibility(supplyType: SupplyType): { showCgstSgst, showIgst }` — mutual exclusivity logic
    - Implement `formatBulkZipFilename(startDate: Date, endDate: Date): string` — "invoices_YYYYMMDD_YYYYMMDD.zip" format
    - _Requirements: 1.1, 1.2, 4.2, 4.3, 7.3, 8.3, 9.2, 10.5_

  - [ ]* 2.2 Write property tests for invoice-utils (Properties 1, 2, 5, 6, 14, 15, 16)
    - **Property 1: Financial Year Calculation** — dates in Jan-Mar map to previous year's FY, April-Dec to current year's FY, format matches `\d{2}-\d{2}`
    - **Property 2: Invoice Number Format** — for any valid FY and sequence 1-9999, output matches `INV/\d{2}-\d{2}/\d{4}`
    - **Property 5: Invoice Filename Generation** — all "/" replaced with "-", ends with ".pdf", reversible
    - **Property 6: Tax Column Mutual Exclusivity** — intra-state shows CGST+SGST only, inter-state shows IGST only
    - **Property 14: Logo Scaling Aspect Ratio** — fits within bounds, preserves ratio, maximizes size
    - **Property 15: Address Formatting Line Breaks** — splits at commas/newlines, trims whitespace
    - **Property 16: Bulk ZIP Filename Format** — matches `invoices_\d{8}_\d{8}\.zip`
    - Create file at `__tests__/properties/invoice-utils.property.test.ts`
    - Use fast-check with minimum 100 iterations per property
    - **Validates: Requirements 1.1, 1.2, 4.2, 4.3, 7.3, 8.3, 9.2, 10.5**

  - [x] 2.3 Create `lib/number-to-words.ts` with Indian numbering conversion
    - Implement `numberToIndianWords(amount: number): string` — converts to "Rupees ... and ... Paise Only"
    - Support Indian numbering: ones, tens, hundreds, thousands, lakhs, crores (up to 99 crores)
    - Handle zero paise (omit paise part), zero rupees, and boundary values
    - _Requirements: 4.8_

  - [ ]* 2.4 Write property test for number-to-words (Property 9)
    - **Property 9: Number to Words Round-Trip Consistency** — for any positive number with ≤2 decimal places, output contains "Rupees"; if paise > 0, output contains "Paise"
    - Add to `__tests__/properties/invoice-utils.property.test.ts`
    - **Validates: Requirements 4.8**

  - [x] 2.5 Create `lib/qr-generator.ts` QR code generation wrapper
    - Implement `generateQrCodeBuffer(data: string): Promise<Buffer>` — uses qrcode package
    - Configure error correction level M (15% recovery)
    - Output PNG buffer suitable for pdf-lib embedding
    - _Requirements: 5.1, 5.3, 5.4_

  - [ ]* 2.6 Write property test for QR code (Property 10)
    - **Property 10: QR Code Round-Trip** — encode then decode produces original string unchanged
    - Note: Requires qrcode for encoding and a decoder for verification (or verify buffer is non-empty and deterministic)
    - Add to `__tests__/properties/invoice-utils.property.test.ts`
    - **Validates: Requirements 5.1, 5.4**

- [ ] 3. Checkpoint - Verify utility libraries
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Zod validators
  - [x] 4.1 Create `validators/invoice.validator.ts`
    - Define `generateInvoiceSchema` — validates saleId as UUID
    - Define `bulkDownloadSchema` — validates saleIds array, min 1, max 100, each UUID
    - Define `invoiceTemplateSchema` — validates hex colors, font enum, text lengths (500/300)
    - Define `invoiceListFiltersSchema` — validates financialYear regex, date coercion, status enum, search max 100
    - Export inferred types: `GenerateInvoiceInput`, `BulkDownloadInput`, `InvoiceTemplateInput`, `InvoiceListFilters`
    - _Requirements: 8.4, 8.5, 9.1, 9.3, 9.4, 11.3_

- [x] 5. Implement service layer
  - [x] 5.1 Create `services/invoice-number.service.ts`
    - Implement `assignInvoiceNumber(companyId, saleId, saleDate)` — idempotent number assignment
    - Use database transaction with `SELECT ... FOR UPDATE` on `invoice_number_sequences` row
    - If no sequence row exists for company+FY, create one with lastSequence=0 then increment
    - If sale already has invoice record, return existing number (idempotent)
    - Return `{ invoiceNumber, isNew }` result
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 5.2 Write property tests for invoice number service (Properties 3, 4)
    - **Property 3: Invoice Number Idempotency** — re-calling for same sale returns same number without incrementing
    - **Property 4: Invoice Number Uniqueness Within Sequence** — N consecutive calls produce N distinct, monotonically increasing sequences
    - Create file at `__tests__/properties/invoice-number.property.test.ts`
    - **Validates: Requirements 1.4, 1.6, 7.5**

  - [x] 5.3 Create `services/invoice-template.service.ts`
    - Implement `getTemplateConfig(companyId)` — returns config with defaults if no row exists
    - Implement `updateTemplateConfig(companyId, config)` — upsert pattern (insert if not exists, update if exists)
    - Default values: headerColor="#FFFFFF", accentColor="#1a237e", font="Roboto", empty strings for texts
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 5.4 Create `services/invoice-pdf.service.ts`
    - Implement `generateInvoicePdf(invoiceData, templateConfig)` — returns PDF Buffer
    - Use pdf-lib to create A4 document (210mm x 297mm)
    - Render sections: header (logo + seller details + channel badge), buyer details, line items table with tax columns, totals row, amount in words, QR code (80x80px bottom-right), terms/bank details footer
    - Apply template colors and font settings
    - Handle conditional tax columns (CGST+SGST or IGST based on supply type)
    - Display HSN "N/A" for products without HSN code
    - Display "GSTIN: Not Registered" if seller has no GSTIN
    - Display "Offline" as default channel if none assigned
    - Use `numberToIndianWords` for total in words
    - Use `generateQrCodeBuffer` for QR code embedding
    - Use `scaleLogo` for logo sizing
    - Use `formatAddress` for address line breaks
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.5, 6.1, 6.2, 6.3, 6.4, 7.6, 7.7, 9.1, 9.2, 9.5, 9.6_

  - [ ]* 5.5 Write property tests for PDF-related computations (Properties 7, 8)
    - **Property 7: Line Item Totals Aggregation** — sums of individual amounts equal totals row, all rounded to 2 decimal places
    - **Property 8: Monetary Values 2 Decimal Places** — all computed monetary fields have ≤2 decimal places
    - Add to `__tests__/properties/invoice-utils.property.test.ts`
    - **Validates: Requirements 4.6, 4.7**

  - [x] 5.6 Create `services/invoice.service.ts`
    - Implement `generateInvoice(companyId, input)` — orchestrates: validate sale status, assign number, gather data, render PDF, return result with warnings
    - Implement `listInvoices(companyId, params, filters)` — paginated list with financial year, date range, channel, status filters
    - Implement `searchInvoices(companyId, query, params)` — search by invoice number, customer name, or buyer GSTIN
    - Implement `cancelInvoice(companyId, invoiceId)` — marks status as CANCELLED, retains record
    - Validate: reject PENDING/CANCELLED sales with ServiceError 400
    - Collect warnings for missing seller address, buyer address, seller GSTIN
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 5.7 Write property test for sale status validation (Property 17)
    - **Property 17: Sale Status Validation for Generation** — PENDING/CANCELLED always rejected, COMPLETED always proceeds
    - Add to `__tests__/properties/invoice-service.property.test.ts`
    - **Validates: Requirements 7.4**

  - [x] 5.8 Create `services/invoice-bulk.service.ts`
    - Implement `bulkDownloadInvoices(companyId, input)` — generate multiple PDFs, package into ZIP
    - Validate saleIds count ≤ 100, reject with ServiceError 400 if exceeded
    - Skip non-COMPLETED sales (add to skipped array)
    - Continue on individual generation failures (add to failed array)
    - Assign invoice numbers in sale date order for new invoices
    - Use jszip to create ZIP archive with individual PDF files
    - Generate ZIP filename using `formatBulkZipFilename`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 5.9 Write property tests for bulk service (Properties 11, 12, 13)
    - **Property 11: Bulk Download Status Filtering** — only COMPLETED sales produce PDFs, generated + skipped = total input
    - **Property 12: Bulk Download Limit Enforcement** — >100 always rejected, ≤100 always proceeds
    - **Property 13: Bulk Invoice Number Ordering** — assigned numbers are monotonically increasing by sale date
    - Create file at `__tests__/properties/invoice-bulk.property.test.ts`
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5, 8.7**

- [ ] 6. Checkpoint - Verify services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement API route handlers
  - [x] 7.1 Create `app/api/invoices/generate/route.ts` (POST)
    - Authenticate request using `authMiddleware`
    - Parse and validate body with `generateInvoiceSchema`
    - Call `generateInvoice(user.companyId, input)`
    - Return PDF buffer as response with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="{filename}"`
    - Include warnings in `X-Invoice-Warnings` header (JSON array)
    - Handle ServiceError and ZodError using existing error handling pattern
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 7.2 Create `app/api/invoices/bulk-download/route.ts` (POST)
    - Authenticate request using `authMiddleware`
    - Parse and validate body with `bulkDownloadSchema`
    - Call `bulkDownloadInvoices(user.companyId, input)`
    - Return ZIP buffer with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="{filename}"`
    - Include summary (generated, skipped, failed counts) in response headers
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 7.3 Create `app/api/invoices/route.ts` (GET)
    - Authenticate request using `authMiddleware`
    - Parse query params: pagination (page, limit), filters (financialYear, startDate, endDate, salesChannelId, status, search)
    - If `search` param present, use `searchInvoices`; otherwise use `listInvoices`
    - Return paginated JSON response with invoice records and pagination meta
    - _Requirements: 11.3, 11.5, 11.6_

  - [x] 7.4 Create `app/api/invoices/[id]/download/route.ts` (GET)
    - Authenticate request using `authMiddleware`
    - Fetch invoice record by ID, verify company ownership
    - Regenerate PDF from current sale data using stored invoice number
    - Return PDF buffer as downloadable response
    - _Requirements: 11.2_

  - [x] 7.5 Create `app/api/invoice-templates/route.ts` (GET, PATCH)
    - GET: Return current template config for company (with defaults)
    - PATCH: Validate body with `invoiceTemplateSchema`, update config
    - Authenticate and scope to `user.companyId`
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.7_

- [ ] 8. Checkpoint - Verify API routes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integration wiring and final validation
  - [x] 9.1 Wire all components together and verify end-to-end flow
    - Verify schema exports are complete in `db/schema/index.ts`
    - Verify all service imports resolve correctly
    - Verify API routes import services and validators correctly
    - Run `npm run build` to ensure no TypeScript errors
    - _Requirements: 7.1, 8.1, 11.1_

  - [ ]* 9.2 Write integration tests for invoice generation flow
    - Test single invoice generation for a completed sale (full flow)
    - Test bulk download with mixed statuses (verify skip/fail behavior)
    - Test invoice list with filters and pagination
    - Test template CRUD operations
    - Test invoice re-generation uses existing number
    - Test sale cancellation marks invoice as CANCELLED
    - Create file at `__tests__/unit/invoice-integration.test.ts`
    - _Requirements: 7.1, 7.4, 7.5, 8.1, 8.2, 8.8, 9.7, 11.2, 11.4_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The GST Filing Assistant spec adds `buyerGstin`, `placeOfSupply`, `salesChannelId`, `marketplaceOrderId` to sales and tax columns to sale_items — these are assumed present
- All services follow existing pure-function, company-scoped patterns (see `expense.service.ts`)
- API routes follow existing error handling pattern (see `app/api/expenses/route.ts`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "2.3", "2.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "4.1"] },
    { "id": 3, "tasks": ["5.1", "5.3"] },
    { "id": 4, "tasks": ["5.2", "5.4"] },
    { "id": 5, "tasks": ["5.5", "5.6"] },
    { "id": 6, "tasks": ["5.7", "5.8"] },
    { "id": 7, "tasks": ["5.9", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
