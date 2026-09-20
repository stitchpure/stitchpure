# Implementation Plan: GST Filing Assistant

## Overview

Server-side GST filing assistant integrated into the existing stock management system. Adds pure utility libraries for tax computation, 7 service files, 18 API endpoints, 8 new database tables, schema extensions to existing tables, and 4 frontend pages. Uses Drizzle ORM migrations, Zod v4 validation, and the xlsx (SheetJS) library for Excel import/export.

## Tasks

- [ ] 1. Install dependency and create pure utility libraries
  - [ ] 1.1 Install xlsx (SheetJS) dependency
    - Run `npm install xlsx` to add the SheetJS library
    - Verify it appears in package.json dependencies
    - _Requirements: 9.2, 14.1_

  - [ ] 1.2 Create `lib/gstin-validator.ts`
    - Export `GstinValidationResult` interface: `{ valid: boolean; stateCode: string | null; error: string | null }`
    - Implement `validateGstin(gstin: string): GstinValidationResult`
    - Validate: 15 chars, first 2 digits state code 01-37, chars 3-12 PAN pattern, char 13 digit/uppercase, char 14 is 'Z', char 15 checksum
    - Implement `gstinMatchesState(gstin: string, stateCode: string): boolean`
    - _Requirements: 1.2, 1.5, 2.1, 2.7_

  - [ ] 1.3 Create `lib/hsn-validator.ts`
    - Export `validateHsnCode(hsn: string): { valid: boolean; error: string | null }`
    - Valid only if string is entirely numeric digits and length is exactly 4, 6, or 8
    - _Requirements: 1.6, 11.1_

  - [ ] 1.4 Create `lib/gst-calculator.ts`
    - Export types: `GstRate`, `PricingMode`, `SupplyType`, `TaxBreakdown`, `TaxCalculationInput`, `ItcUtilizationInput`, `ItcUtilizationResult`
    - Implement `determineSupplyType(placeOfSupply, registeredState): SupplyType`
    - Implement `deriveTaxableValue(amount, gstRate, pricingMode): number` — inclusive: amount/(1+rate/100) rounded 2dp; exclusive: amount
    - Implement `splitTax(totalTax, supplyType): { cgst, sgst, igst }` — intra: each half, inter: full IGST
    - Implement `calculateTax(input: TaxCalculationInput): TaxBreakdown` — full tax computation
    - Implement `calculateItcUtilization(input: ItcUtilizationInput): ItcUtilizationResult` — waterfall: IGST credit first (→IGST→CGST→SGST), then CGST credit (→CGST), then SGST credit (→SGST), then TCS credit
    - Implement `calculateTcs(taxableValue, supplyType): { tcsCgst, tcsSgst, tcsIgst, totalTcs }` — 1% TCS with intra/inter split
    - All monetary outputs rounded to 2 decimal places
    - _Requirements: 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.6, 13.1, 13.2, 13.5_

  - [ ]* 1.5 Write property tests for GSTIN validator (`__tests__/properties/gstin-validator.property.test.ts`)
    - **Property 1: GSTIN Format Validation**
    - **Property 2: GSTIN State Code Extraction**
    - **Validates: Requirements 1.2, 1.5, 2.7**

  - [ ]* 1.6 Write property tests for HSN validator (`__tests__/properties/hsn-validator.property.test.ts`)
    - **Property 3: HSN Code Format Validation**
    - **Validates: Requirements 1.6, 11.1**

  - [ ]* 1.7 Write property tests for GST calculator (`__tests__/properties/gst-calculator.property.test.ts`)
    - **Property 5: Tax Split Mutual Exclusivity**
    - **Property 6: Taxable Value Derivation**
    - **Property 7: Tax Calculation Formula Correctness**
    - **Property 8: Monetary Values Rounded to 2 Decimal Places**
    - **Property 9: ITC Ledger Balance Invariant**
    - **Property 10: ITC Utilization Waterfall Order**
    - **Property 11: TCS Calculation**
    - **Property 25: GSTR-3B Net Tax Computation**
    - **Validates: Requirements 2.5, 2.6, 3.1-3.6, 5.3, 5.6, 6.2, 6.6, 6.7, 13.1, 13.2, 13.5**

  - [ ]* 1.8 Write property test for B2B/B2C classification (`__tests__/properties/gst-classification.property.test.ts`)
    - **Property 4: B2B/B2C Classification**
    - **Validates: Requirements 2.3, 2.4**

- [ ] 2. Checkpoint - Ensure pure utility library tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Create database schema and migrations
  - [ ] 3.1 Create `db/schema/gst-config.ts`
    - Define `gstConfig` table: id, companyId (FK cascade, unique), gstin, registeredState, defaultGstRate, pricingMode, timestamps
    - Export table for use in schema index
    - _Requirements: 1.1, 1.2_

  - [ ] 3.2 Create `db/schema/hsn-gst-rates.ts`
    - Define `hsnGstRates` table: id, companyId (FK cascade), hsnCode, gstRate, description, timestamps
    - Add unique constraint on (companyId, hsnCode)
    - _Requirements: 11.1, 11.2_

  - [ ] 3.3 Create `db/schema/sales-channels.ts`
    - Define `salesChannels` table: id, companyId (FK cascade), name, isMarketplace, tcsApplicable, isActive, timestamps
    - Add unique constraint on (companyId, name)
    - _Requirements: 12.1, 12.4_

  - [ ] 3.4 Create `db/schema/itc-ledger.ts`
    - Define `itcLedger` table: id, companyId (FK cascade), month, year, opening/additions/utilization/closing for CGST, SGST, IGST, timestamps
    - Add unique constraint on (companyId, month, year)
    - _Requirements: 6.1, 6.2_

  - [ ] 3.5 Create `db/schema/tcs-ledger.ts`
    - Define `tcsLedger` table: id, companyId (FK cascade), saleId (FK set null), marketplace, orderReference, transactionDate, taxableValue, tcsRate, tcsCgst, tcsSgst, tcsIgst, totalTcs, source, isReconciled, timestamps
    - _Requirements: 13.1, 13.2_

  - [ ] 3.6 Create `db/schema/settlement-imports.ts`
    - Define `settlementImportStatusEnum` enum: SUCCESS, PARTIAL, FAILED
    - Define `settlementImports` table: id, companyId (FK cascade), fileName, marketplace, periodStart, periodEnd, totalOrders, matchedOrders, unmatchedOrders, duplicateOrders, totalTcsFromFile, totalTcsCalculated, status, importedBy (FK users), createdAt
    - Define `settlementImportItems` table: id, importId (FK cascade), orderId, orderDate, productPrice, commission, tcsAmount, shippingFee, netPayout, matchedSaleId (FK set null), matchStatus, createdAt
    - _Requirements: 14.5, 14.8, 14.10_

  - [ ] 3.7 Create `db/schema/gst-filing-status.ts`
    - Define `gstFilingStatusEnum` enum: FILED, PENDING, OVERDUE
    - Define `gstFilingStatus` table: id, companyId (FK cascade), month, year, gstr1Status, gstr3bStatus, gstr1FiledAt, gstr3bFiledAt, timestamps
    - Add unique constraint on (companyId, month, year)
    - _Requirements: 10.4_

  - [ ] 3.8 Extend existing schemas with GST columns
    - Add to `db/schema/supplier.ts`: gstin (varchar 15), state (varchar 2)
    - Add to `db/schema/sale.ts` (sales): buyerGstin (varchar 15), placeOfSupply (varchar 2), salesChannelId (FK salesChannels, set null), marketplaceOrderId (varchar 100)
    - Add to `db/schema/sale.ts` (saleItems): taxableValue, cgstAmount, sgstAmount, igstAmount, totalTax, gstRate (all numeric)
    - Add to `db/schema/purchase.ts` (purchaseItems): taxableValue, cgstAmount, sgstAmount, igstAmount, totalTax, gstRate (all numeric)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 12.1_

  - [ ] 3.9 Update `db/schema/index.ts` to export all new schemas
    - Export gstConfig, hsnGstRates, salesChannels, itcLedger, tcsLedger, settlementImports, settlementImportItems, gstFilingStatus
    - _Requirements: All_

  - [ ] 3.10 Generate and run database migration
    - Run `npm run db:generate` to generate migration SQL
    - Verify migration file is created in `db/migrations/`
    - _Requirements: All_

- [ ] 4. Checkpoint - Ensure schema compiles and migration generates successfully
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create Zod validators for GST module
  - [ ] 5.1 Create `validators/gst.validator.ts`
    - Export `gstConfigSchema`: gstin (15-char regex), registeredState (2-digit 01-37), defaultGstRate (enum 0/5/12/18/28), pricingMode (inclusive/exclusive)
    - Export `hsnRateMappingSchema`: hsnCode (regex 4/6/8 digits), gstRate (enum), description (optional)
    - Export `salesChannelSchema`: name (1-100 chars), isMarketplace (boolean), tcsApplicable (boolean)
    - Export `filingStatusSchema`: month (1-12), year (2017-2100), status (filed/pending)
    - Export `tcsEntrySchema`: marketplace, orderReference, transactionDate, taxableValue, tcsRate, tcsCgst, tcsSgst, tcsIgst
    - Export `bulkHsnAssignmentSchema`: array of { productId, hsnCode, gstRate }
    - Export `bulkChannelAssignmentSchema`: array of { saleId, salesChannelId }
    - Export all inferred types
    - _Requirements: 1.1, 1.2, 1.6, 11.1, 11.8, 12.6, 13.6_

- [ ] 6. Implement GST Tax Service (config, HSN mapping, tax calculation)
  - [ ] 6.1 Create `services/gst-tax.service.ts` — GST config CRUD
    - Implement `getGstConfig(companyId)`: fetch company GST config, return null if not set
    - Implement `upsertGstConfig(companyId, data)`: validate GSTIN format + state match using lib validators, upsert config
    - Use `gstin-validator.ts` for GSTIN validation, throw ServiceError on mismatch
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 6.2 Create `services/gst-tax.service.ts` — HSN-rate mapping CRUD
    - Implement `getHsnRateMappings(companyId, pagination)`: list all mappings
    - Implement `createHsnRateMapping(companyId, data)`: validate HSN format, check duplicate (409 if exists), insert
    - Implement `updateHsnRateMapping(companyId, id, data)`: update existing mapping
    - Implement `deleteHsnRateMapping(companyId, id)`: soft delete or hard delete
    - Implement `bulkAssignHsnRates(companyId, assignments[])`: process up to 500, return success/fail counts
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ] 6.3 Create `services/gst-tax.service.ts` — Tax calculation on transactions
    - Implement `calculateSaleItemTax(saleItem, placeOfSupply, registeredState, gstRate, pricingMode)`: compute and return TaxBreakdown
    - Implement `resolveGstRate(productHsnCode, companyId)`: lookup HSN mapping → company default → throw if neither
    - Implement `applySaleTax(companyId, saleId)`: compute tax for all line items of a sale, update sale_items with tax columns
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 6.4 Create `services/gst-tax.service.ts` — Sales channel management
    - Implement `getSalesChannels(companyId)`: list active channels
    - Implement `createSalesChannel(companyId, data)`: create custom channel
    - Implement `updateSalesChannel(companyId, id, data)`: update channel
    - Implement `deleteSalesChannel(companyId, id)`: soft-delete (set isActive=false)
    - Implement `bulkAssignChannel(companyId, assignments[])`: update salesChannelId on up to 500 sales
    - _Requirements: 12.1, 12.2, 12.4, 12.6, 12.7_

  - [ ]* 6.5 Write property test for HSN rate auto-assignment vs manual override (`__tests__/properties/gst-hsn-rates.property.test.ts`)
    - **Property 24: HSN Rate Auto-Assignment vs Manual Override**
    - **Validates: Requirements 11.3, 11.4, 11.7**

- [ ] 7. Implement GST Report Service (GSTR-1, GSTR-3B, HSN, Party-wise)
  - [ ] 7.1 Create `services/gst-report.service.ts` — GSTR-1 generation
    - Implement `generateGstr1(companyId, periodStart, periodEnd)`: query COMPLETED sales in date range
    - Build B2B section: invoice-level data with buyer GSTIN, place of supply, tax breakdown
    - Build B2C section: aggregate by rate slab (0/5/12/18/28)
    - Build HSN summary section: aggregate by HSN code
    - Build document summary: invoice count, number range, cancelled count
    - Exclude CANCELLED sales from all sections
    - Support quarterly periods (Q1-Q4 aligned to financial year Apr-Mar)
    - Return empty report with zero values when no data exists
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ] 7.2 Create `services/gst-report.service.ts` — GSTR-3B generation
    - Implement `generateGstr3b(companyId, month, year)`: calculate output liability from non-cancelled sales
    - Calculate eligible ITC from RECEIVED purchases in the month
    - Compute net tax payable per head (CGST, SGST, IGST independently)
    - Segregate supplies: taxable (rate > 0), nil-rated (rate = 0 + HSN registered), exempt
    - Separate inter-state vs intra-state breakdowns
    - Show excess ITC as carry-forward when ITC > liability for a head
    - Return zero-value summary when no data exists
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 7.3 Create `services/gst-report.service.ts` — HSN summary
    - Implement `generateHsnSummary(companyId, periodStart, periodEnd, filter)`: aggregate by HSN code
    - Include: total quantity, taxable value, CGST, SGST, IGST, total tax per HSN
    - Sort by taxable value descending
    - Group products without HSN under "NO-HSN" with warning label
    - Support filter: sales-only, purchases-only, combined
    - Return empty table with message when no transactions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 7.4 Create `services/gst-report.service.ts` — Party-wise summary
    - Implement `generatePartySummary(companyId, periodStart, periodEnd, partyType)`: aggregate by GSTIN
    - Show per party: transaction count, total taxable value, CGST, SGST, IGST totals
    - Group null/empty GSTIN as "Unregistered Parties" in customer view only
    - Sort by total taxable value descending
    - Separate customer (outward) and supplier (inward) views
    - Support monthly, quarterly (financial year aligned), annual filtering
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.5 Write property tests for report generation (`__tests__/properties/gst-reports.property.test.ts`)
    - **Property 12: GSTR-1 Sales Filter (Status + Date Range)**
    - **Property 13: B2C Aggregation by Rate Slab**
    - **Property 14: HSN Summary Aggregation and Sort Order**
    - **Property 15: Party-wise Summary Grouping and Sort**
    - **Property 16: Sales Channel Report Filtering**
    - **Property 17: Channel Percentage Contribution**
    - **Validates: Requirements 4.1, 4.3, 4.7, 7.1, 7.3, 7.4, 8.1, 8.3, 8.4, 12.2, 12.3, 12.5**

- [ ] 8. Implement ITC and TCS Services
  - [ ] 8.1 Create `services/gst-itc.service.ts`
    - Implement `getItcLedger(companyId, month, year)`: fetch or create ledger entry for the month
    - Implement `addItcFromPurchase(companyId, purchaseId)`: when purchase status → RECEIVED, sum line item taxes and add to monthly additions
    - Implement `reverseItcFromPurchase(companyId, purchaseId)`: when RECEIVED → CANCELLED, record negative entry in current month
    - Implement `calculateMonthlyItc(companyId, month, year)`: sum eligible CGST, SGST, IGST from RECEIVED purchases
    - Implement `updateItcUtilization(companyId, month, year, utilization)`: record utilization amounts
    - Implement `rollForwardBalance(companyId, month, year)`: set next month's opening = current closing
    - Closing = opening + additions - utilization for each head
    - Exclude CANCELLED and PENDING purchases from ITC
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 8.2 Create `services/gst-tcs.service.ts`
    - Implement `getTcsLedger(companyId, month, year)`: list TCS entries for the month
    - Implement `autoCalculateTcs(companyId, saleId)`: when sale tagged with marketplace channel, compute TCS at 1% and insert into tcs_ledger with source='auto'
    - Implement `createManualTcsEntry(companyId, data)`: manual TCS entry with source='manual'
    - Implement `updateTcsEntry(companyId, id, data)`: allow override, flag as reconciliation needed if differs from auto
    - Implement `getMonthlyTcsSummary(companyId, month, year)`: total TCS per marketplace
    - Implement `getQuarterlyReconciliation(companyId, quarter, year)`: compare system vs marketplace TCS, flag mismatches > INR 100
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [ ]* 8.3 Write property test for TCS reconciliation threshold (`__tests__/properties/gst-tcs.property.test.ts`)
    - **Property 23: TCS Reconciliation Threshold**
    - **Validates: Requirements 13.8**

- [ ] 9. Checkpoint - Ensure service layer compiles and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Settlement Import Service
  - [ ] 10.1 Create `services/gst-settlement-import.service.ts` — File parsing
    - Implement `parseSettlementFile(buffer, fileType)`: use xlsx library to read Excel/CSV
    - Implement `detectMarketplace(headers[])`: auto-detect Flipkart (Order ID, Invoice Number, Settlement Value, TCS Amount, Commission, Shipping Fee, Net Payout) or Meesho (Sub Order No, Order Date, Product Price, Meesho Commission, TCS Deducted, Net Payment)
    - Return `{ detected: boolean, marketplace: string | null, rows: ParsedRow[] }`
    - Validate file size ≤ 10MB before parsing
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ] 10.2 Create `services/gst-settlement-import.service.ts` — Order matching and TCS update
    - Implement `matchOrders(companyId, parsedRows[])`: match by orderId/subOrderNo against sales.marketplaceOrderId
    - Return match summary: { totalOrders, matched, unmatched, duplicates }
    - Implement `processImport(companyId, userId, file, marketplace)`: orchestrate parse → match → update TCS ledger → save import record
    - For matched orders: update tcs_ledger with actual TCS from file (source='import')
    - Track import in settlement_imports table with all counts
    - Save individual items in settlement_import_items with matchStatus
    - _Requirements: 14.5, 14.6, 14.7, 14.9_

  - [ ] 10.3 Create `services/gst-settlement-import.service.ts` — Duplicate detection and history
    - Implement `checkDuplicateImport(companyId, fileName, periodStart, periodEnd)`: check settlement_imports for same file/period
    - Implement `getImportHistory(companyId, pagination)`: list imports with all metadata
    - Implement `getReconciliationSummary(importId)`: compare TCS from file vs auto-calculated
    - _Requirements: 14.8, 14.9, 14.10_

  - [ ]* 10.4 Write property test for settlement import count invariant (`__tests__/properties/gst-settlement.property.test.ts`)
    - **Property 22: Settlement Import Count Invariant**
    - **Validates: Requirements 14.5**

- [ ] 11. Implement Export and Validation Services
  - [ ] 11.1 Create `services/gst-export.service.ts`
    - Implement `exportGstr1Excel(companyId, month, year)`: generate .xlsx with B2B, B2C, HSN worksheets matching GST portal template
    - Implement `exportGstr1Json(companyId, month, year)`: generate JSON matching GST portal offline tool structure
    - Implement `exportHsnSummary(companyId, periodStart, periodEnd)`: 12-column format Excel
    - Implement `generateFilename(reportType, gstin, month, year, ext)`: pattern `{TYPE}_{GSTIN}_{MMYYYY}.{ext}`
    - Pre-export validation: check required fields, mark missing cells with background color in Excel, include validation_errors in JSON
    - On system failure: throw ServiceError, produce no partial file
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 11.2 Create `services/gst-validation.service.ts`
    - Implement `validateReportData(companyId, periodStart, periodEnd)`: run all validation checks
    - ERROR checks: missing GSTIN on B2B invoices, duplicate invoice numbers in same financial year
    - WARNING checks: missing HSN codes on line items, invoice number sequence gaps
    - Return results grouped by severity with affected transaction identifiers
    - Determine report status: "Draft — Contains Errors" if any ERROR, "Ready for Filing" otherwise
    - Execute within 10 seconds for reasonable data volumes
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ]* 11.3 Write property tests for filing status derivation (`__tests__/properties/gst-filing-status.property.test.ts`)
    - **Property 18: Filing Status Derivation**
    - **Property 19: Variance Alert Threshold**
    - **Validates: Requirements 10.4, 10.6, 10.8**

  - [ ]* 11.4 Write property tests for export filename (`__tests__/properties/gst-export.property.test.ts`)
    - **Property 20: Export Filename Pattern**
    - **Property 26: Pre-Export Validation Count**
    - **Validates: Requirements 9.4, 9.7**

  - [ ]* 11.5 Write property tests for validation severity (`__tests__/properties/gst-validation.property.test.ts`)
    - **Property 21: Validation Severity Classification**
    - **Validates: Requirements 15.2, 15.3, 15.4, 15.5**

- [ ] 12. Checkpoint - Ensure all services compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Create API route handlers — Config and HSN
  - [ ] 13.1 Create `app/api/gst/config/route.ts`
    - GET: authMiddleware → getGstConfig(companyId) → return config or null
    - PATCH: authMiddleware → requireRole(MANAGER, OWNER) → validate body with gstConfigSchema → upsertGstConfig → return updated
    - Follow existing error handling pattern (handleError with ZodError/ServiceError)
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 13.2 Create `app/api/gst/hsn-rates/route.ts`
    - GET: authMiddleware → getHsnRateMappings(companyId, pagination) → return paginated list
    - POST: authMiddleware → requireRole(MANAGER, OWNER) → validate with hsnRateMappingSchema → createHsnRateMapping → return 201
    - _Requirements: 11.1, 11.2, 11.6_

  - [ ] 13.3 Create `app/api/gst/hsn-rates/[id]/route.ts`
    - PATCH: authMiddleware → requireRole(MANAGER, OWNER) → updateHsnRateMapping → return updated
    - DELETE: authMiddleware → requireRole(MANAGER, OWNER) → deleteHsnRateMapping → return 200
    - _Requirements: 11.4, 11.5_

  - [ ] 13.4 Create `app/api/gst/hsn-rates/bulk/route.ts`
    - POST: authMiddleware → requireRole(MANAGER, OWNER) → validate bulkHsnAssignmentSchema → bulkAssignHsnRates → return success/failure summary
    - _Requirements: 11.8_

- [ ] 14. Create API route handlers — Reports and Export
  - [ ] 14.1 Create `app/api/gst/reports/gstr1/route.ts`
    - GET: authMiddleware → parse query params (month, year, quarter, channelId) → generateGstr1 → return report
    - _Requirements: 4.1, 4.8, 12.2_

  - [ ] 14.2 Create `app/api/gst/reports/gstr3b/route.ts`
    - GET: authMiddleware → parse query params (month, year) → generateGstr3b → include TCS credit line → return summary
    - _Requirements: 5.1, 13.3_

  - [ ] 14.3 Create `app/api/gst/reports/hsn-summary/route.ts`
    - GET: authMiddleware → parse query params (periodStart, periodEnd, filter) → generateHsnSummary → return data
    - _Requirements: 7.1, 7.5_

  - [ ] 14.4 Create `app/api/gst/reports/party-summary/route.ts`
    - GET: authMiddleware → parse query params (periodStart, periodEnd, partyType) → generatePartySummary → return data
    - _Requirements: 8.1, 8.5_

  - [ ] 14.5 Create `app/api/gst/export/gstr1/route.ts`
    - GET: authMiddleware → parse query params (month, year, format: xlsx|json) → exportGstr1Excel or exportGstr1Json → stream file response with correct Content-Type and Content-Disposition headers
    - _Requirements: 9.1, 9.2, 9.7_

  - [ ] 14.6 Create `app/api/gst/export/hsn/route.ts`
    - GET: authMiddleware → parse query params (periodStart, periodEnd) → exportHsnSummary → stream xlsx response
    - _Requirements: 9.3_

  - [ ] 14.7 Create `app/api/gst/validate/route.ts`
    - GET: authMiddleware → parse query params (periodStart, periodEnd) → validateReportData → return validation results with severity grouping
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 15. Create API route handlers — ITC, TCS, Settlement, Dashboard
  - [ ] 15.1 Create `app/api/gst/itc/route.ts`
    - GET: authMiddleware → parse query params (month, year) → getItcLedger → return ledger entry
    - _Requirements: 6.2, 6.3_

  - [ ] 15.2 Create `app/api/gst/tcs/route.ts`
    - GET: authMiddleware → parse query params (month, year) → getTcsLedger → return entries
    - POST: authMiddleware → requireRole(MANAGER, OWNER) → validate tcsEntrySchema → createManualTcsEntry → return 201
    - PATCH: authMiddleware → requireRole(MANAGER, OWNER) → updateTcsEntry → return updated
    - _Requirements: 13.1, 13.4, 13.6_

  - [ ] 15.3 Create `app/api/gst/tcs/reconciliation/route.ts`
    - GET: authMiddleware → parse query params (quarter, year) → getQuarterlyReconciliation → return report
    - _Requirements: 13.8_

  - [ ] 15.4 Create `app/api/gst/sales-channels/route.ts`
    - GET: authMiddleware → getSalesChannels(companyId) → return list
    - POST: authMiddleware → requireRole(MANAGER, OWNER) → validate salesChannelSchema → createSalesChannel → return 201
    - _Requirements: 12.1, 12.7_

  - [ ] 15.5 Create `app/api/gst/sales-channels/[id]/route.ts`
    - PATCH: authMiddleware → requireRole(MANAGER, OWNER) → updateSalesChannel → return updated
    - DELETE: authMiddleware → requireRole(MANAGER, OWNER) → deleteSalesChannel → return 200
    - _Requirements: 12.1_

  - [ ] 15.6 Create `app/api/gst/settlement-import/route.ts`
    - POST: authMiddleware → requireRole(MANAGER, OWNER) → parse multipart form data → validate file size/format → processImport → return import summary with match results
    - _Requirements: 14.1, 14.4, 14.5, 14.8_

  - [ ] 15.7 Create `app/api/gst/settlement-import/history/route.ts`
    - GET: authMiddleware → getImportHistory(companyId, pagination) → return paginated import logs
    - _Requirements: 14.10_

  - [ ] 15.8 Create `app/api/gst/filing-status/route.ts`
    - GET: authMiddleware → parse query params (year) → return filing status for all months in the year
    - PATCH: authMiddleware → requireRole(MANAGER, OWNER) → validate filingStatusSchema → update filing status → return updated
    - _Requirements: 10.4_

  - [ ] 15.9 Create `app/api/gst/dashboard/route.ts`
    - GET: authMiddleware → parse query params (month, year) → aggregate: total sales, total purchases, output tax, ITC available, net payable, CGST/SGST/IGST breakdown, channel-wise summary, filing status, 12-month trend, variance alert
    - Default to current month when no params provided
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 12.3, 12.5_

- [ ] 16. Checkpoint - Ensure all API routes compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Create frontend pages — GST Dashboard
  - [ ] 17.1 Create `app/(dashboard)/gst/dashboard/page.tsx`
    - Client component fetching from `/api/gst/dashboard`
    - Display monthly overview: total sales, purchases, output tax, ITC available, net payable (2dp INR)
    - CGST/SGST/IGST columns for output and input credit
    - Filing status indicators (Filed/Pending/Overdue) for each month
    - Channel-wise tax summary table (per channel: count, taxable value, CGST, SGST, IGST, total)
    - Channel percentage contribution section
    - 12-month trend chart (tax liability vs ITC claimed)
    - 20% variance alert indicator when applicable
    - Month selector (default: current month)
    - Show zero values with informational message when no data
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 12.3, 12.5, 13.4_

- [ ] 18. Create frontend pages — GST Config
  - [ ] 18.1 Create `app/(dashboard)/gst/config/page.tsx`
    - Client component with tabbed interface: GST Settings, HSN Rate Mapping, Sales Channels
    - GST Settings tab: form for GSTIN, registered state (dropdown 37 states), default rate (dropdown slabs), pricing mode
    - GSTIN real-time validation with error display
    - HSN Rate Mapping tab: table with CRUD operations, bulk assignment interface (up to 500)
    - HSN code validation on entry (4/6/8 digits)
    - Duplicate HSN confirmation dialog
    - Sales Channels tab: list channels with add/edit/delete, marketplace toggle, TCS applicable toggle
    - All forms with accessible labels, aria-live error regions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 11.1, 11.2, 11.3, 11.4, 11.6, 11.8, 12.1, 12.4, 12.7_

- [ ] 19. Create frontend pages — GST Reports
  - [ ] 19.1 Create `app/(dashboard)/gst/reports/page.tsx`
    - Client component with report type selector: GSTR-1, GSTR-3B, HSN Summary, Party-wise Summary
    - Period picker: month, quarter (Q1-Q4 financial year), annual (Apr-Mar)
    - Channel filter dropdown (optional)
    - GSTR-1 view: B2B table, B2C aggregated table, HSN summary table, document summary
    - GSTR-3B view: output liability, ITC available, TCS credit, net payable per head, supply segregation
    - HSN Summary view: sortable table with filter (sales/purchases/combined)
    - Party-wise view: customer and supplier tabs, grouped by GSTIN, sorted by taxable value
    - Pre-generation validation panel: show errors/warnings before report, clickable links to transactions
    - Report status badge: "Draft — Contains Errors" or "Ready for Filing"
    - Export buttons: Download Excel, Download JSON (GSTR-1 only)
    - ITC ledger section: opening, additions, utilization, closing per head
    - _Requirements: 4.1-4.9, 5.1-5.7, 7.1-7.6, 8.1-8.6, 9.1-9.8, 12.2, 13.3, 15.1-15.6_

- [ ] 20. Create frontend pages — Settlement Import
  - [ ] 20.1 Create `app/(dashboard)/gst/import/page.tsx`
    - Client component with file upload interface (drag-drop + file picker)
    - Accept .xlsx, .xls, .csv files up to 10MB
    - Auto-detect marketplace display with manual override option
    - Match summary display: total orders, matched, unmatched, duplicates
    - Unmatched orders section with manual mapping option
    - Reconciliation summary: TCS from file vs auto-calculated, order-wise mismatches > INR 1
    - Duplicate import warning dialog with skip/re-import options
    - Import history table: date, filename, marketplace, period, orders, match rate %, status
    - TCS reconciliation tab: quarterly view, system vs marketplace comparison, mismatch flags > INR 100
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 13.7, 13.8_

- [ ] 21. Add GST navigation to sidebar
  - [ ] 21.1 Add GST section to sidebar navigation
    - Add "GST" section to `components/layout/Sidebar.tsx` NAV_SECTIONS with links: Dashboard (/gst/dashboard), Config (/gst/config), Reports (/gst/reports), Import (/gst/import)
    - Role restriction: MANAGER and OWNER only
    - Active state highlighting for GST routes
    - _Requirements: 10.1_

- [ ] 22. Write unit tests for services
  - [ ]* 22.1 Write unit tests for GST calculator (`__tests__/unit/gst-calculator.test.ts`)
    - Known-answer tests: 18% inclusive on ₹1180 → taxable ₹1000, CGST ₹90, SGST ₹90 (intra-state)
    - Edge cases: 0% rate, very large amounts, inter-state IGST
    - ITC utilization waterfall with specific numeric examples
    - TCS calculation examples for both supply types
    - _Requirements: 3.1-3.6, 6.6, 13.1_

  - [ ]* 22.2 Write unit tests for GSTIN validator (`__tests__/unit/gstin-validator.test.ts`)
    - Valid GSTIN examples (known real format patterns)
    - Invalid: wrong length, invalid state code (00, 38+), wrong checksum, missing Z at position 14
    - State code matching: 07AABCU9603R1ZM matches state "07", does not match "29"
    - _Requirements: 1.2, 1.5, 2.7_

  - [ ]* 22.3 Write unit tests for report generation (`__tests__/unit/gst-report.test.ts`)
    - GSTR-1 with known dataset: verify B2B/B2C split, HSN aggregation, document summary
    - GSTR-3B: verify net payable calculation with known ITC values
    - Empty period returns zero-value report
    - Quarterly period includes all 3 months
    - _Requirements: 4.1-4.9, 5.1-5.7_

  - [ ]* 22.4 Write unit tests for settlement parser (`__tests__/unit/gst-settlement-parser.test.ts`)
    - Mock Meesho file structure: detect columns, parse rows correctly
    - Mock Flipkart file structure: detect columns, parse rows correctly
    - Unknown format returns detected=false
    - File size validation
    - _Requirements: 14.1-14.4_

  - [ ]* 22.5 Write unit tests for export service (`__tests__/unit/gst-export.test.ts`)
    - Filename generation: verify pattern for all report types and months
    - JSON structure: verify top-level keys match GST portal format
    - Excel: verify worksheet names and column headers
    - Validation errors included in both formats
    - _Requirements: 9.1-9.8_

  - [ ]* 22.6 Write unit tests for ITC service (`__tests__/unit/gst-itc.test.ts`)
    - ITC addition from received purchase
    - ITC reversal on cancellation
    - Monthly balance roll-forward
    - Utilization waterfall with TCS credit
    - _Requirements: 6.1-6.7_

- [ ] 23. Final checkpoint - Ensure all tests pass and build succeeds
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate 26 universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `xlsx` library handles both reading settlement files and writing export files
- All new database tables follow the existing company-scoped pattern with cascade deletes
- API routes follow the existing pattern: authMiddleware → requireRole → validate → service call → response
- Frontend pages are client components under the `(dashboard)` route group
- GST columns on existing tables are nullable to support incremental adoption
- Filing status "Overdue" is computed (not stored) based on current date vs 20th of following month

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["1.7", "1.8", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"] },
    { "id": 3, "tasks": ["3.8", "3.9", "5.1"] },
    { "id": 4, "tasks": ["3.10"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["6.5", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 7, "tasks": ["7.5", "8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "11.1", "11.2"] },
    { "id": 10, "tasks": ["10.4", "11.3", "11.4", "11.5"] },
    { "id": 11, "tasks": ["13.1", "13.2", "13.3", "13.4"] },
    { "id": 12, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7"] },
    { "id": 13, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "15.8", "15.9"] },
    { "id": 14, "tasks": ["17.1", "18.1"] },
    { "id": 15, "tasks": ["19.1", "20.1", "21.1"] },
    { "id": 16, "tasks": ["22.1", "22.2", "22.3", "22.4", "22.5", "22.6"] }
  ]
}
```
