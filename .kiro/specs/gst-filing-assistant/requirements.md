# Requirements Document

## Introduction

GST Filing Assistant feature jo existing stock management application mein integrate hoga. Yeh feature monthly/quarterly GST returns (GSTR-1, GSTR-3B) ke liye required data automatically compile karega existing sales, purchases, aur expenses data se. User ko GST portal pe manual data entry ke burden se relief milega — system ready-to-upload reports generate karega Excel/JSON format mein.

Current system mein sales, purchases, aur product HSN codes already track ho rahe hain. Yeh feature un data points ko GST-compliant reports mein transform karega with proper tax breakdowns (CGST, SGST, IGST), HSN-wise summaries, aur party-wise aggregations.

## Glossary

- **GST_System**: The GST filing assistant module that generates tax reports and manages GST-related data
- **Tax_Calculator**: The computation engine responsible for calculating CGST, SGST, and IGST amounts from taxable values
- **Report_Generator**: The component that compiles transaction data into GSTR-1 and GSTR-3B formatted reports
- **ITC_Tracker**: The Input Tax Credit tracking component that calculates claimable tax credit from purchases
- **Export_Engine**: The component that converts report data into Excel (.xlsx) and JSON formats for GST portal upload
- **GSTIN**: Goods and Services Tax Identification Number — 15-digit unique identifier for GST-registered businesses
- **HSN_Code**: Harmonized System of Nomenclature code — used to classify goods for tax purposes
- **CGST**: Central Goods and Services Tax — central government's share of GST on intra-state supplies
- **SGST**: State Goods and Services Tax — state government's share of GST on intra-state supplies
- **IGST**: Integrated Goods and Services Tax — tax on inter-state supplies (IGST = CGST + SGST rate)
- **GSTR-1**: Monthly/quarterly return for outward supplies (sales) details
- **GSTR-3B**: Monthly summary return with tax liability and ITC claims
- **ITC**: Input Tax Credit — credit of tax paid on purchases that can be offset against output tax
- **Place_of_Supply**: The state/UT where goods are delivered, determines whether CGST+SGST or IGST applies
- **Taxable_Value**: The value on which GST is calculated (total amount minus GST)
- **B2B**: Business-to-Business transactions (where buyer has GSTIN)
- **B2C**: Business-to-Consumer transactions (where buyer does not have GSTIN)
- **Reverse_Charge**: Mechanism where buyer pays GST instead of seller (for specified services)
- **TCS**: Tax Collected at Source — 1% tax collected by e-commerce operators (Meesho, Flipkart, etc.) on behalf of sellers under Section 52 of CGST Act
- **Sales_Channel**: The platform or medium through which a sale is made (e.g., Meesho, Flipkart, Amazon, Offline)
- **TCS_Ledger**: Monthly record of TCS amounts collected by marketplaces, used for claiming credit in GSTR-3B
- **Settlement_File**: Excel/CSV report downloaded from marketplace seller panels containing order-wise payment, commission, and TCS deduction details
- **Order_Matching**: Process of linking imported marketplace orders to existing sale records in the system using Order ID or Sub Order No

## Requirements

### Requirement 1: GST Configuration Setup

**User Story:** As a business owner, I want to configure my GST details (GSTIN, state, tax rates) in the system, so that the system can correctly calculate and categorize taxes on all transactions.

#### Acceptance Criteria

1. THE GST_System SHALL provide a GST configuration page where business GSTIN, registered state (selected from 37 Indian state/UT codes), and default tax rate (selected from standard GST slabs: 0%, 5%, 12%, 18%, 28%) can be stored
2. WHEN a GSTIN is entered, THE GST_System SHALL validate the GSTIN format (15-character alphanumeric pattern: 2-digit state code + 10-char PAN + 1-digit entity + 1-char 'Z' + 1-digit checksum) and verify that the 2-digit state code in the GSTIN matches the selected registered state
3. THE GST_System SHALL allow configuration of multiple GST tax slabs (0%, 5%, 12%, 18%, 28%) mapped to product categories or HSN codes
4. WHEN a product does not have an HSN code assigned, THE GST_System SHALL flag the product as "GST-incomplete" in all GST reports and validation summaries
5. IF an invalid GSTIN format is entered or the GSTIN state code does not match the selected registered state, THEN THE GST_System SHALL display a validation error indicating the specific format violation and prevent the configuration from being saved
6. WHEN an HSN code is entered for a product or in the HSN-rate mapping, THE GST_System SHALL validate that the HSN code is a numeric value of 4, 6, or 8 digits in length and reject codes that do not conform

### Requirement 2: Customer and Supplier GSTIN Management

**User Story:** As a business owner, I want to store GSTIN for customers and suppliers, so that the system can classify transactions as B2B or B2C and calculate inter-state vs intra-state taxes correctly.

#### Acceptance Criteria

1. THE GST_System SHALL extend supplier records to include GSTIN (validated against the 15-character alphanumeric GSTIN format) and state (2-digit Indian state/UT code) fields
2. THE GST_System SHALL extend sale records to include buyer GSTIN (optional) and Place_of_Supply (state) as a mandatory field
3. WHEN a sale has a buyer GSTIN, THE GST_System SHALL classify the transaction as B2B
4. WHEN a sale does not have a buyer GSTIN, THE GST_System SHALL classify the transaction as B2C
5. WHEN Place_of_Supply matches the registered business state, THE Tax_Calculator SHALL split tax as CGST and SGST (each equal to total GST rate divided by 2, rounded to 2 decimal places)
6. WHEN Place_of_Supply differs from the registered business state, THE Tax_Calculator SHALL apply the full rate as IGST
7. IF a buyer GSTIN is provided and does not match the 15-character GSTIN format, THEN THE GST_System SHALL reject the entry and display a validation error indicating the format violation
8. IF Place_of_Supply is not provided when creating or updating a sale, THEN THE GST_System SHALL prevent saving the sale and display an error indicating that Place_of_Supply is required for tax calculation

### Requirement 3: Tax Calculation on Transactions

**User Story:** As a business owner, I want GST to be automatically calculated on sales and purchases, so that I have accurate tax breakdowns for each transaction without manual computation.

#### Acceptance Criteria

1. WHEN a sale is created or updated, THE Tax_Calculator SHALL compute taxable_value, CGST, SGST, and IGST amounts for each line item based on the line item's HSN code GST rate and the sale's Place_of_Supply, applying CGST+SGST (equal halves) for intra-state and IGST (full rate) for inter-state supplies
2. WHEN a purchase is created or updated, THE Tax_Calculator SHALL compute and store tax breakdown (taxable_value, cgst_amount, sgst_amount, igst_amount, total_tax, gst_rate) for each purchase line item based on the supplier's state and the business registered state
3. THE Tax_Calculator SHALL store tax breakdown (taxable_value, cgst_amount, sgst_amount, igst_amount, total_tax, gst_rate) for each sale line item, with all monetary amounts rounded to 2 decimal places
4. THE Tax_Calculator SHALL ensure mutual exclusivity of tax split: each line item SHALL have either CGST+SGST amounts with IGST as zero, or IGST amount with CGST and SGST as zero, never both simultaneously
5. THE Tax_Calculator SHALL derive taxable_value using the formula: total_amount / (1 + gst_rate/100) when prices are GST-inclusive, with the result rounded to 2 decimal places
6. THE Tax_Calculator SHALL derive taxable_value as total_amount when prices are GST-exclusive, and compute total as taxable_value + total_tax
7. WHEN a product's HSN code has no mapped GST rate, THE Tax_Calculator SHALL use the company's default GST rate
8. IF a product has no mapped GST rate and no company default GST rate is configured, THEN THE Tax_Calculator SHALL block the transaction save and display an error message indicating that a GST rate must be configured before the transaction can be recorded

### Requirement 4: GSTR-1 Report Generation (Outward Supplies)

**User Story:** As a business owner, I want the system to generate GSTR-1 report data from my sales, so that I can file my monthly/quarterly outward supply return without manually compiling invoice data.

#### Acceptance Criteria

1. WHEN a user requests GSTR-1 report for a specific period (calendar month or quarter), THE Report_Generator SHALL compile all COMPLETED sales whose invoice date falls within the selected period's start and end dates (inclusive)
2. THE Report_Generator SHALL categorize B2B invoices in the B2B section with: invoice number, invoice date, buyer GSTIN, Place_of_Supply (state code), taxable value, CGST amount, SGST amount, IGST amount, and invoice total value
3. THE Report_Generator SHALL aggregate B2C sales by tax rate slab (0%, 5%, 12%, 18%, 28%) into the B2C (Others) section, showing for each slab: total taxable value, CGST amount, SGST amount, IGST amount, and total tax collected
4. THE Report_Generator SHALL generate HSN-wise summary with columns: HSN code, description, UQC (unit), total quantity, taxable value, IGST, CGST, SGST amounts
5. THE Report_Generator SHALL include document summary showing: total number of invoices issued, invoice number range (first and last invoice number), and count of cancelled documents in the period
6. IF no completed sales exist for the selected period, THEN THE Report_Generator SHALL generate an empty report with all sections present and all numeric values set to zero instead of showing an error
7. THE Report_Generator SHALL exclude CANCELLED sales from all report sections
8. WHEN the report period is set to quarterly, THE Report_Generator SHALL compile sales across all 3 months of the selected quarter (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar) following the Indian financial year
9. THE Report_Generator SHALL generate the complete GSTR-1 report within 30 seconds for up to 10,000 sales transactions in the selected period

### Requirement 5: GSTR-3B Summary Generation

**User Story:** As a business owner, I want a GSTR-3B summary report, so that I can quickly file my monthly tax liability and ITC claims return.

#### Acceptance Criteria

1. WHEN a user requests GSTR-3B summary for a specific month, THE Report_Generator SHALL calculate total outward supply liability by summing taxable value, CGST, SGST, and IGST from all non-cancelled sales within that month's date range
2. WHEN generating GSTR-3B summary, THE Report_Generator SHALL calculate eligible ITC by summing CGST, SGST, and IGST amounts from purchases with status RECEIVED within that month
3. THE Report_Generator SHALL compute net tax payable independently for each tax head: net CGST payable (output CGST minus ITC CGST), net SGST payable (output SGST minus ITC SGST), and net IGST payable (output IGST minus ITC IGST)
4. THE Report_Generator SHALL segregate outward supplies into: taxable supplies (GST rate greater than 0%), nil-rated supplies (GST rate equal to 0% where HSN is GST-registered), and exempt supplies (products/categories explicitly marked as GST-exempt in configuration)
5. THE Report_Generator SHALL present inter-state and intra-state supply breakdowns separately, showing taxable value and applicable tax amounts (IGST for inter-state, CGST + SGST for intra-state) for each breakdown
6. IF net tax payable for any individual tax head is negative (ITC exceeds liability for that component), THEN THE Report_Generator SHALL show the excess as ITC carry-forward amount for that specific tax head (CGST, SGST, or IGST independently)
7. IF no sales and no received purchases exist for the selected month, THEN THE Report_Generator SHALL generate a GSTR-3B summary with all values set to zero

### Requirement 6: Input Tax Credit (ITC) Tracking

**User Story:** As a business owner, I want to track Input Tax Credit from my purchases, so that I can accurately claim ITC and reduce my GST liability.

#### Acceptance Criteria

1. WHEN a purchase status changes to RECEIVED, THE ITC_Tracker SHALL mark the CGST, SGST, and IGST tax amounts from the purchase line items as eligible ITC for the purchase date's month
2. THE ITC_Tracker SHALL maintain a monthly ITC ledger showing for each tax component (CGST, SGST, IGST) separately: opening balance (carry-forward from previous month, zero for the first month of system use), additions (from newly received purchases), utilization (offset against output liability), and closing balance (opening + additions - utilization)
3. WHEN calculating GSTR-3B, THE ITC_Tracker SHALL provide total eligible CGST, SGST, and IGST credit separately
4. THE ITC_Tracker SHALL exclude ITC from CANCELLED or PENDING purchases
5. IF a previously RECEIVED purchase is CANCELLED, THEN THE ITC_Tracker SHALL reverse the corresponding CGST, SGST, and IGST amounts by recording a negative entry in the month when the cancellation occurs
6. WHEN utilizing ITC against output tax liability, THE ITC_Tracker SHALL apply IGST credit first (against IGST liability, then CGST, then SGST), followed by CGST credit (against CGST liability), followed by SGST credit (against SGST liability)
7. IF ITC available exceeds the total output tax liability for a month, THEN THE ITC_Tracker SHALL carry forward the unused ITC balance as the opening balance of the next month's ledger

### Requirement 7: HSN-wise Summary Report

**User Story:** As a business owner, I want HSN-wise tax summary, so that I can fill the HSN summary table in GST returns accurately.

#### Acceptance Criteria

1. WHEN a user requests HSN summary for a period (month, quarter, or financial year), THE Report_Generator SHALL aggregate all non-CANCELLED transactions within that date range grouped by HSN code
2. THE Report_Generator SHALL include for each HSN code: total quantity (sold or purchased depending on filter), taxable value, CGST amount, SGST amount, IGST amount, and total tax collected, with all monetary values rounded to 2 decimal places
3. THE Report_Generator SHALL sort the HSN summary by taxable value in descending order
4. WHEN a product has no HSN code, THE Report_Generator SHALL group those transactions under a "NO-HSN" category and display a visible text label "Missing HSN — update product master" alongside that row
5. THE Report_Generator SHALL support filtering HSN summary by sales-only, purchases-only, or combined view
6. IF the selected period contains zero non-CANCELLED transactions, THEN THE Report_Generator SHALL display the HSN summary table with a single row showing all zero values and a message indicating no transactions found for the period

### Requirement 8: Party-wise GST Summary

**User Story:** As a business owner, I want party-wise (customer/supplier) GST summary, so that I can reconcile transactions and verify ITC with suppliers' filings.

#### Acceptance Criteria

1. WHEN a user requests party-wise summary for a specified period, THE Report_Generator SHALL aggregate transactions grouped by GSTIN and display results sorted by total taxable value in descending order
2. THE Report_Generator SHALL show for each party: total number of transactions, total taxable value, total CGST, total SGST, and total IGST paid/collected, with all monetary values rounded to 2 decimal places
3. THE Report_Generator SHALL separate customer summary (outward supplies) and supplier summary (inward supplies) into distinct views, each independently scrollable and filterable
4. WHEN a party has no GSTIN (B2C customers), THE Report_Generator SHALL group those transactions under "Unregistered Parties" in the customer summary view only
5. WHEN a user applies a date range filter, THE Report_Generator SHALL support monthly, quarterly (aligned to financial year: Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar), and annual (April to March) filtering
6. IF no transactions exist for the selected party type and date range, THEN THE Report_Generator SHALL display an empty summary with zero totals instead of an error

### Requirement 9: Export Reports for GST Portal Upload

**User Story:** As a business owner, I want to export GST reports in formats accepted by the GST portal, so that I can directly upload them without manual re-entry.

#### Acceptance Criteria

1. THE Export_Engine SHALL export GSTR-1 data in JSON format compatible with the GST portal's offline tool import structure, including B2B, B2C, HSN, and document summary sections
2. THE Export_Engine SHALL export GSTR-1 data in Excel (.xlsx) format matching the GST portal's Excel template column structure with separate worksheets for B2B, B2C, and HSN sections
3. THE Export_Engine SHALL export HSN summary in the standard 12-column format (HSN, Description, UQC, Total Qty, Total Value, Taxable Value, IGST, CGST, SGST, Cess, Total Tax, Rate)
4. WHEN exporting, THE Export_Engine SHALL validate that all required fields (GSTIN format, HSN codes, invoice numbers) are present and report a count of missing or invalid fields to the user before generating the file
5. IF required fields are missing in export data, THEN THE Export_Engine SHALL generate the Excel export with missing field cells marked with a distinct background color and include a separate "Validation Errors" sheet listing each error with row reference, field name, and issue description
6. IF required fields are missing in JSON export data, THEN THE Export_Engine SHALL include a top-level "validation_errors" array in the JSON output, with each entry specifying the section, record index, field name, and issue description
7. THE Export_Engine SHALL name exported files with pattern: `{report_type}_{GSTIN}_{period}.{extension}` where period format is MMYYYY (e.g., GSTR1_07AABCU9603R1ZM_012024.xlsx for January 2024)
8. IF the export process fails due to a system error or data processing failure, THEN THE Export_Engine SHALL display an error message indicating the failure reason and shall not produce a partial or corrupted file

### Requirement 10: GST Dashboard and Monthly Overview

**User Story:** As a business owner, I want a GST dashboard showing monthly tax summary at a glance, so that I can track my GST position without generating full reports.

#### Acceptance Criteria

1. THE GST_System SHALL display a monthly overview for the user-selected month (defaulting to the current month on first load) showing: total sales amount, total purchases amount, output tax liability, ITC available, and net tax payable (computed as output tax liability minus ITC available), with all monetary values displayed to 2 decimal places in INR
2. THE GST_System SHALL show tax collection breakdown as CGST, SGST, and IGST in separate columns for both output liability and input credit
3. WHEN the current month is selected, THE GST_System SHALL show running totals that refresh within 5 seconds of a new transaction being added to the system
4. THE GST_System SHALL display filing status indicators for each month as one of: "Filed" (user-marked as filed), "Pending" (not yet marked and due date not passed), or "Overdue" (not marked as filed and the current date is past the 20th of the following month)
5. THE GST_System SHALL provide a 12-month tax trend chart showing monthly tax liability vs ITC claimed for the 12 months ending with the currently selected month
6. WHEN a month's net tax payable changes by more than 20% compared to the previous month, THE GST_System SHALL display an alert indicator next to that month showing the percentage variance
7. IF the selected month has no completed transactions, THEN THE GST_System SHALL display all summary values as zero with an informational message indicating no transaction data is available for the period
8. IF a month has no previous month data available for comparison (first month of system usage or previous month has zero net tax), THEN THE GST_System SHALL suppress the 20% variance alert for that month

### Requirement 11: Tax Rate and HSN Code Mapping

**User Story:** As a business owner, I want to map GST rates to HSN codes at a master level, so that every product with that HSN automatically gets the correct rate applied.

#### Acceptance Criteria

1. THE GST_System SHALL maintain an HSN-to-GST-rate master mapping table that accepts HSN codes of 4, 6, or 8 digits and rejects codes not matching these lengths
2. THE GST_System SHALL support standard GST slabs: 0%, 5%, 12%, 18%, 28% as the only valid rates for both HSN mappings and product-level overrides
3. WHEN a new product is created with an HSN code that exists in the mapping, THE GST_System SHALL auto-assign the corresponding GST rate to the product
4. THE GST_System SHALL allow manual override of GST rate at the product level, and WHEN an HSN code mapping is subsequently updated, THE GST_System SHALL preserve the manual override and not replace it with the new mapping rate
5. WHEN an HSN code mapping is updated, THE GST_System SHALL apply the new rate only to future transactions and to products using that HSN that do not have a manual override (existing transactions retain their original rate)
6. IF a user attempts to create a mapping for an HSN code that already exists, THEN THE GST_System SHALL prompt for confirmation to update the existing mapping rather than creating a duplicate entry
7. WHEN a product's HSN code is changed to a code that exists in the mapping and the product has no manual rate override, THE GST_System SHALL auto-assign the new HSN code's corresponding GST rate
8. THE GST_System SHALL provide a bulk HSN-rate assignment interface for updating up to 500 products per operation, and IF any products in the batch cannot be updated, THEN THE GST_System SHALL complete the remaining updates and display a summary indicating the count of successful and failed assignments with identifiers of failed products

### Requirement 12: Sales Channel Tracking

**User Story:** As a business owner selling on multiple platforms (Meesho, Flipkart, offline), I want to tag each sale with its sales channel, so that I can see platform-wise GST liability breakdown and reconcile with marketplace statements.

#### Acceptance Criteria

1. THE GST_System SHALL provide a "Sales Channel" field on every sale record with predefined options: Meesho, Flipkart, Amazon, Offline, and Other (user-configurable custom channels)
2. WHEN generating GSTR-1, GSTR-3B, or any GST summary report, THE Report_Generator SHALL support optional filtering by sales channel, showing tax breakdowns for the selected channel(s) only
3. THE GST_System SHALL display a channel-wise tax summary on the GST dashboard showing for each channel: total sales count, total taxable value, total CGST, total SGST, total IGST, and total tax collected for the selected month
4. WHEN a sale is created without a sales channel tag, THE GST_System SHALL default the channel to "Offline" and allow the user to change it before or after saving
5. THE Report_Generator SHALL include a "Channel Summary" section in the monthly GST overview showing percentage contribution of each channel to total tax liability
6. THE GST_System SHALL allow bulk channel assignment for updating the sales channel tag on up to 500 existing sales in a single operation
7. IF a user adds a custom sales channel, THEN THE GST_System SHALL make it available in all channel filter dropdowns and reports immediately after creation

### Requirement 13: Marketplace TCS (Tax Collected at Source) Tracking

**User Story:** As a seller on Meesho and Flipkart, I want to track TCS collected by marketplaces on my behalf, so that I can claim TCS credit in my GSTR-3B filing and reduce my net tax liability.

#### Acceptance Criteria

1. THE GST_System SHALL maintain a TCS ledger recording for each marketplace transaction: marketplace name, order reference number, transaction date, taxable value, TCS rate (default 1% under Section 52 of CGST Act), and TCS amount (split as 0.5% CGST + 0.5% SGST for intra-state, or 1% IGST for inter-state)
2. WHEN a sale is tagged with a marketplace channel (Meesho, Flipkart, Amazon), THE GST_System SHALL auto-calculate expected TCS at 1% of net taxable value and record it in the TCS ledger for that month
3. WHEN generating GSTR-3B, THE Report_Generator SHALL include TCS credit as a separate line item under eligible ITC, showing total TCS CGST, TCS SGST, and TCS IGST claimable for the month
4. THE GST_System SHALL display monthly TCS summary on the dashboard showing: total TCS collected by each marketplace, total TCS claimed against liability, and pending TCS credit balance
5. THE ITC_Tracker SHALL add TCS credit to the ITC utilization waterfall: after utilizing regular ITC (IGST → CGST → SGST), TCS credit SHALL be applied against any remaining liability
6. THE GST_System SHALL support manual entry and adjustment of TCS amounts to reconcile with marketplace payment statements (e.g., Meesho's monthly settlement report or Flipkart's tax invoice)
7. IF the auto-calculated TCS differs from the actual TCS shown in the marketplace statement, THEN THE GST_System SHALL allow the user to override the amount and flag the discrepancy with a "Reconciliation Needed" indicator
8. THE GST_System SHALL generate a quarterly TCS reconciliation report comparing system-calculated TCS vs marketplace-reported TCS, grouped by marketplace and month, highlighting mismatches exceeding INR 100

### Requirement 14: Marketplace Settlement File Import

**User Story:** As a seller on Meesho and Flipkart, I want to upload marketplace settlement/payment files, so that the system can auto-extract TCS amounts, match orders, and reconcile with my recorded sales without manual data entry.

#### Acceptance Criteria

1. THE GST_System SHALL provide a file upload interface accepting Excel (.xlsx, .xls) and CSV (.csv) files up to 10MB in size for marketplace settlement imports
2. THE GST_System SHALL support parsing Flipkart settlement reports by detecting columns: Order ID, Invoice Number, Settlement Value, TCS Amount, Commission, Shipping Fee, and Net Payout
3. THE GST_System SHALL support parsing Meesho payment summary reports by detecting columns: Sub Order No, Order Date, Product Price, Meesho Commission, TCS Deducted, and Net Payment
4. WHEN a file is uploaded, THE GST_System SHALL auto-detect the marketplace (Flipkart or Meesho) based on column headers and file structure, and IF detection fails, THEN prompt the user to manually select the marketplace
5. WHEN parsing is complete, THE GST_System SHALL attempt to match each imported order with existing sales records using Order ID/Sub Order No, and display a match summary showing: total orders in file, successfully matched, unmatched (not found in system), and duplicates (already imported)
6. FOR each matched order, THE GST_System SHALL extract the TCS amount from the settlement file and update the TCS ledger entry for that order, replacing the auto-calculated estimate with the actual marketplace-reported TCS amount
7. IF an imported order cannot be matched to any existing sale record, THEN THE GST_System SHALL list it in an "Unmatched Orders" section and allow the user to manually map it to a sale or create a new sale record from the imported data
8. THE GST_System SHALL prevent duplicate imports by tracking previously imported file names and date ranges, and IF a duplicate file is detected, THEN display a warning with the option to skip or re-import (overwriting previous data)
9. AFTER a successful import, THE GST_System SHALL display a reconciliation summary showing: total TCS from file vs total auto-calculated TCS, order-wise mismatches exceeding INR 1, and net difference with a "Reconciled" or "Discrepancy Found" status
10. THE GST_System SHALL maintain an import history log showing: upload date, file name, marketplace, period covered, total orders processed, match rate percentage, and import status (success/partial/failed)

### Requirement 15: GST Report Data Validation

**User Story:** As a business owner, I want the system to validate my data before generating GST reports, so that I can fix issues before filing and avoid notices from the tax department.

#### Acceptance Criteria

1. WHEN generating any GST report, THE GST_System SHALL run pre-generation validation checks on the underlying data and display validation results within 10 seconds before presenting the report
2. THE GST_System SHALL check for the following issues classified by severity: ERROR-level — missing GSTIN on B2B invoices, duplicate invoice numbers within the same financial year; WARNING-level — missing HSN codes on line items, gaps in invoice number sequences (non-consecutive numbering within a month)
3. THE GST_System SHALL generate a validation report listing all issues grouped by severity (ERROR — blocks filing, WARNING — should review), showing for each issue the check type, affected transaction identifier, and a description of the problem
4. IF validation finds ERROR-level issues, THEN THE GST_System SHALL still generate the report but mark it as "Draft — Contains Errors" and display the count of error-level issues on the report header
5. IF validation finds only WARNING-level issues or no issues, THEN THE GST_System SHALL generate the report marked as "Ready for Filing"
6. THE GST_System SHALL provide a clickable navigation element from each validation issue to the specific transaction record that needs correction
