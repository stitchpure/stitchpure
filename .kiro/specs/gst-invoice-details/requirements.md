# Requirements Document

## Introduction

This feature adds GST-related fields to the stock management e-commerce application to support proper GST-compliant invoicing. It introduces a GSTIN field on the company (seller) side, and buyer GSTIN, shipping address, and place of supply fields on the sales (buyer) side. The invoice PDF is updated to display real GST data instead of hardcoded placeholders, and the UI is updated across company settings, sales forms, and sales detail pages.

## Glossary

- **Company**: The seller entity that owns the stock management account and issues invoices
- **GSTIN**: Goods and Services Tax Identification Number, a 15-character alphanumeric identifier assigned to GST-registered businesses in India
- **Sale**: A transaction record representing a sale to a buyer, stored in the sales table
- **Billing_Address**: The buyer's address used for billing purposes, stored as `buyerAddress` in the sales table
- **Shipping_Address**: The buyer's address where goods are delivered, which defaults to the billing address when not specified
- **Place_of_Supply**: The Indian state or Union Territory where goods are delivered, used to determine applicable tax type
- **IGST**: Integrated GST, applied on inter-state transactions (seller and buyer in different states)
- **CGST**: Central GST, applied on intra-state transactions (seller and buyer in same state)
- **SGST**: State GST, applied on intra-state transactions alongside CGST
- **Invoice_PDF_Service**: The service that generates GST-compliant tax invoice PDFs using pdf-lib
- **Company_Settings_Page**: The UI page at /company where company profile details are managed
- **Sales_Create_Form**: The UI form used to create a new sale record
- **Sales_Detail_Page**: The UI page displaying full details of a specific sale
- **Validator**: Zod schema definitions used for backend request validation

## Requirements

### Requirement 1: Company GSTIN Storage

**User Story:** As a business owner, I want to store my company's GSTIN in the system, so that it appears on all invoices generated for my company.

#### Acceptance Criteria

1. THE Company schema SHALL include a `gstin` field of type varchar with a maximum length of 15 characters
2. THE Company schema SHALL allow the `gstin` field to be null for companies that are not GST-registered
3. WHEN a GSTIN value is provided, THE Validator SHALL verify that the value is exactly 15 alphanumeric characters matching the pattern `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
4. IF a GSTIN value does not match the required format, THEN THE Validator SHALL return a descriptive error message indicating the expected format

### Requirement 2: Company GSTIN Management UI

**User Story:** As a business owner, I want to enter and edit my GSTIN on the company settings page, so that I can keep my GST registration details up to date.

#### Acceptance Criteria

1. THE Company_Settings_Page SHALL display a GSTIN input field in the company profile form
2. THE Company_Settings_Page SHALL allow the GSTIN field to be submitted as empty for non-registered companies
3. WHEN the user enters a GSTIN value, THE Company_Settings_Page SHALL display the current GSTIN value in the input field on page load
4. WHEN the user submits the company profile form with a valid GSTIN, THE Company_Settings_Page SHALL save the GSTIN value to the company record
5. IF the user submits an invalid GSTIN format, THEN THE Company_Settings_Page SHALL display a validation error message without submitting the form

### Requirement 3: Sale GST Fields Storage

**User Story:** As a business owner, I want to capture buyer GSTIN, shipping address, and place of supply for each sale, so that invoices contain the correct GST details for compliance.

#### Acceptance Criteria

1. THE Sale schema SHALL include a `buyerGstin` field of type varchar with a maximum length of 15 characters, allowing null values
2. THE Sale schema SHALL include a `shippingAddress` field of type text, allowing null values
3. THE Sale schema SHALL include a `placeOfSupply` field of type varchar with a maximum length of 50 characters, allowing null values
4. WHEN a `buyerGstin` value is provided during sale creation, THE Validator SHALL verify that the value matches the GSTIN format pattern `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
5. IF a `buyerGstin` value does not match the required format, THEN THE Validator SHALL return a descriptive error message

### Requirement 4: Sales Create Form GST Fields

**User Story:** As a business owner, I want to enter buyer GSTIN, shipping address, and place of supply when creating a sale, so that the invoice generated for the sale contains accurate GST information.

#### Acceptance Criteria

1. THE Sales_Create_Form SHALL display a Buyer GSTIN input field that accepts an optional 15-character alphanumeric value
2. THE Sales_Create_Form SHALL display a Shipping Address text input field that accepts an optional multiline address
3. THE Sales_Create_Form SHALL display a Place of Supply selection field listing Indian states and Union Territories
4. THE Sales_Create_Form SHALL allow all three GST fields to be left empty
5. WHEN the user submits the form with valid GST field values, THE Sales_Create_Form SHALL include the GST fields in the sale creation request
6. IF the user enters an invalid buyer GSTIN format, THEN THE Sales_Create_Form SHALL display a validation error message for the GSTIN field

### Requirement 5: Sales Detail Page GST Display

**User Story:** As a business owner, I want to view buyer GSTIN, shipping address, and place of supply on the sales detail page, so that I can verify GST information before generating an invoice.

#### Acceptance Criteria

1. WHEN a sale has a `buyerGstin` value, THE Sales_Detail_Page SHALL display the buyer GSTIN in the sale details section
2. WHEN a sale has a `shippingAddress` value, THE Sales_Detail_Page SHALL display the shipping address separately from the billing address
3. WHEN a sale does not have a `shippingAddress` value, THE Sales_Detail_Page SHALL display the billing address as both billing and shipping address
4. WHEN a sale has a `placeOfSupply` value, THE Sales_Detail_Page SHALL display the place of supply in the sale details section

### Requirement 6: Invoice PDF Seller GSTIN Display

**User Story:** As a business owner, I want my real GSTIN displayed on generated invoices, so that the invoices are GST-compliant and valid for tax purposes.

#### Acceptance Criteria

1. WHEN the company has a GSTIN value stored, THE Invoice_PDF_Service SHALL display the company GSTIN in the seller details section of the invoice
2. WHEN the company does not have a GSTIN value stored, THE Invoice_PDF_Service SHALL display "GSTIN: Not Registered" in the seller details section
3. THE Invoice_PDF_Service SHALL retrieve the seller GSTIN from the company record when generating an invoice

### Requirement 7: Invoice PDF Buyer Details Display

**User Story:** As a business owner, I want buyer GST details and separate billing/shipping addresses on the invoice, so that the invoice meets GST compliance requirements for B2B transactions.

#### Acceptance Criteria

1. WHEN the sale has a `buyerGstin` value, THE Invoice_PDF_Service SHALL display the buyer GSTIN in the bill-to section of the invoice
2. WHEN the sale does not have a `buyerGstin` value, THE Invoice_PDF_Service SHALL omit the buyer GSTIN line from the bill-to section
3. THE Invoice_PDF_Service SHALL display the `buyerAddress` as the billing address in the invoice
4. WHEN the sale has a `shippingAddress` value, THE Invoice_PDF_Service SHALL display the shipping address in a separate "Ship To" section on the invoice
5. WHEN the sale does not have a `shippingAddress` value, THE Invoice_PDF_Service SHALL use the billing address as the shipping address in the "Ship To" section
6. WHEN the sale has a `placeOfSupply` value, THE Invoice_PDF_Service SHALL display the place of supply on the invoice

### Requirement 8: Database Migration

**User Story:** As a developer, I want a database migration that adds the new GST fields, so that the schema changes are applied consistently across environments.

#### Acceptance Criteria

1. THE migration SHALL add a `gstin` column of type varchar(15) to the companies table, with a default value of null
2. THE migration SHALL add a `buyer_gstin` column of type varchar(15) to the sales table, with a default value of null
3. THE migration SHALL add a `shipping_address` column of type text to the sales table, with a default value of null
4. THE migration SHALL add a `place_of_supply` column of type varchar(50) to the sales table, with a default value of null
5. THE migration SHALL be non-destructive, preserving all existing data in both tables
