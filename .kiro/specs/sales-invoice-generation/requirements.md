# Requirements Document

## Introduction

Sales Invoice Generation feature for the existing stock management application. This feature enables GST-compliant tax invoice PDF generation from sales records. The system supports multi-channel e-commerce selling (Meesho, Flipkart, Offline) and generates invoices with proper tax breakdowns (CGST, SGST, IGST), buyer/seller details, HSN codes, barcode/QR encoding, and sequential financial-year-based invoice numbering.

The system already tracks sales with line items, product HSN codes, and company details. The GST Filing Assistant spec (planned separately) will add buyer GSTIN, place of supply, sales channel, and tax columns to existing tables. This invoice generation feature builds on that foundation to produce downloadable, print-ready PDF invoices compliant with Indian GST tax invoice rules (Section 31 of CGST Act, Rule 46 of CGST Rules).

Key capabilities: single invoice PDF download, bulk invoice ZIP download, invoice template customization (logo, colors, terms), barcode/QR code encoding invoice number, and sales channel tagging on invoice.

## Glossary

- **Invoice_Generator**: The core component responsible for generating GST-compliant PDF invoices from sale records using pdf-lib
- **Invoice_Numbering_Service**: The component that generates and manages sequential invoice numbers per financial year
- **Barcode_Generator**: The component that generates barcode or QR code images encoding the invoice number for scanning
- **Template_Engine**: The component that manages invoice layout customization including logo, colors, fonts, and terms & conditions
- **Bulk_Download_Service**: The component that generates ZIP archives containing multiple invoice PDFs using jszip
- **Invoice_Number**: A unique sequential identifier for each invoice, following the pattern INV/{financial_year}/{sequential_number} (e.g., INV/2024-25/0001)
- **Financial_Year**: The Indian financial year running from April 1 to March 31 (e.g., 2024-25 represents April 2024 to March 2025)
- **HSN_Code**: Harmonized System of Nomenclature code used to classify goods for GST purposes (4, 6, or 8 digits)
- **CGST**: Central Goods and Services Tax — central government's share of GST on intra-state supplies
- **SGST**: State Goods and Services Tax — state government's share of GST on intra-state supplies
- **IGST**: Integrated Goods and Services Tax — tax on inter-state supplies (IGST rate = CGST + SGST rate)
- **GSTIN**: Goods and Services Tax Identification Number — 15-digit unique identifier for GST-registered businesses
- **Place_of_Supply**: The state/UT where goods are delivered; determines whether CGST+SGST or IGST applies
- **B2B_Invoice**: Invoice issued to a GST-registered buyer (buyer GSTIN present)
- **B2C_Invoice**: Invoice issued to an unregistered buyer (no buyer GSTIN)
- **Taxable_Value**: The base value on which GST is calculated (before tax addition)
- **Sales_Channel**: The platform or medium through which a sale is made (Meesho, Flipkart, Offline, Other)
- **Seller_Details**: Company information printed on invoice — name, GSTIN, registered address, phone, email
- **Buyer_Details**: Customer information on invoice — company name (if B2B), GSTIN (if B2B), address, phone

## Requirements

### Requirement 1: Invoice Number Generation

**User Story:** As a seller, I want the system to auto-generate sequential invoice numbers per financial year, so that my invoices follow a consistent numbering pattern compliant with GST rules.

#### Acceptance Criteria

1. WHEN a new invoice is generated for a sale, THE Invoice_Numbering_Service SHALL assign the next sequential invoice number in the format INV/{financial_year}/{zero-padded-sequence} where financial_year is in YY-YY format (e.g., 24-25) and sequence is zero-padded to 4 digits (e.g., 0001)
2. THE Invoice_Numbering_Service SHALL determine the financial year based on the sale date: April 1 to March 31 (sales from April 2024 to March 2025 belong to financial year 2024-25)
3. THE Invoice_Numbering_Service SHALL reset the sequence counter to 0001 at the start of each new financial year (April 1)
4. THE Invoice_Numbering_Service SHALL guarantee uniqueness of invoice numbers within a company — no two invoices for the same company SHALL have the same invoice number
5. WHEN multiple invoices are generated concurrently for the same company, THE Invoice_Numbering_Service SHALL use database-level locking to prevent duplicate sequence numbers
6. IF a sale already has an invoice number assigned, THEN THE Invoice_Numbering_Service SHALL retain the existing invoice number and not generate a new one (idempotent re-generation)
7. THE Invoice_Numbering_Service SHALL store the invoice number, generation timestamp, and financial year in the invoices table linked to the sale record

### Requirement 2: Seller Details on Invoice

**User Story:** As a seller, I want my business details (company name, GSTIN, address, phone) displayed on every invoice, so that buyers can identify my registered business and the invoice is GST-compliant.

#### Acceptance Criteria

1. THE Invoice_Generator SHALL display the following seller details on every invoice: company name, GSTIN, registered address, phone number, and email — sourced from the company profile record
2. WHEN the company profile has a logo uploaded, THE Invoice_Generator SHALL render the company logo in the invoice header area
3. IF the company profile does not have a GSTIN configured, THEN THE Invoice_Generator SHALL display "GSTIN: Not Registered" in place of the GSTIN field
4. IF the company profile does not have a registered address configured, THEN THE Invoice_Generator SHALL display "Address: Not Available" and mark the invoice with a "Seller Address Missing" warning in the generation response
5. THE Invoice_Generator SHALL source seller details from the company record at the time of invoice generation and embed them in the PDF (changes to company profile after generation do not alter previously generated invoices)

### Requirement 3: Buyer Details on Invoice

**User Story:** As a seller, I want buyer details (company name, GSTIN, address, phone) on the invoice, so that B2B buyers can claim Input Tax Credit and the invoice identifies the recipient clearly.

#### Acceptance Criteria

1. THE Invoice_Generator SHALL display buyer details on the invoice: customer name, phone number (sourced from the sale record's customerName and customerPhone fields)
2. WHEN the sale has a buyer GSTIN (B2B sale), THE Invoice_Generator SHALL display the buyer GSTIN and buyer company name on the invoice in the "Bill To" section
3. WHEN the sale does not have a buyer GSTIN (B2C sale), THE Invoice_Generator SHALL omit the GSTIN field from the buyer section and label the section as "Bill To (Unregistered)"
4. THE Invoice_Generator SHALL display the buyer's billing address on the invoice, sourced from the buyerAddress field on the sale record
5. IF the buyer address is not available on the sale record, THEN THE Invoice_Generator SHALL leave the address area blank and mark the invoice with a "Buyer Address Missing" warning in the generation response
6. WHEN the sale has a Place_of_Supply value, THE Invoice_Generator SHALL display the Place of Supply (state name) on the invoice

### Requirement 4: Line Items with Tax Breakdown

**User Story:** As a seller, I want each invoice line item to show HSN code, quantity, rate, taxable value, and GST breakdown (CGST/SGST or IGST), so that the invoice is fully GST-compliant and buyers can verify tax calculations.

#### Acceptance Criteria

1. THE Invoice_Generator SHALL render a line items table on the invoice with columns: S.No, Item Description, HSN Code, Quantity, Unit Rate, Taxable Value, CGST (Rate + Amount), SGST (Rate + Amount), IGST (Rate + Amount), and Total Amount
2. WHEN the sale is intra-state (Place_of_Supply matches seller's registered state), THE Invoice_Generator SHALL show CGST and SGST columns populated with respective rate and amount, and IGST column values as zero or hidden
3. WHEN the sale is inter-state (Place_of_Supply differs from seller's registered state), THE Invoice_Generator SHALL show IGST column populated with rate and amount, and CGST/SGST column values as zero or hidden
4. THE Invoice_Generator SHALL display HSN code for each line item sourced from the product's hsnCode field
5. IF a line item's product does not have an HSN code assigned, THEN THE Invoice_Generator SHALL display "N/A" in the HSN code column for that line item
6. THE Invoice_Generator SHALL display a totals row at the bottom of the line items table showing: total taxable value, total CGST, total SGST, total IGST, and grand total (taxable value + all taxes)
7. THE Invoice_Generator SHALL display all monetary values rounded to 2 decimal places in INR
8. THE Invoice_Generator SHALL display the total invoice amount in words (Indian numbering format — lakhs, crores) below the totals row

### Requirement 5: Barcode/QR Code on Invoice

**User Story:** As a seller, I want a barcode or QR code on the invoice encoding the invoice number, so that I can quickly scan and look up invoices for verification or record-keeping.

#### Acceptance Criteria

1. THE Barcode_Generator SHALL generate a QR code encoding the invoice number string (e.g., "INV/2024-25/0001") and embed it on the invoice PDF
2. THE Invoice_Generator SHALL position the QR code in a fixed location (bottom-right corner of the invoice) with dimensions of 80x80 pixels at 72 DPI
3. THE Barcode_Generator SHALL generate the QR code using error correction level M (15% data recovery capability)
4. WHEN the invoice number contains special characters (forward slashes), THE Barcode_Generator SHALL encode the complete string including special characters without modification
5. THE Invoice_Generator SHALL ensure the QR code does not overlap with any other invoice content (line items, totals, or footer)

### Requirement 6: Sales Channel Display on Invoice

**User Story:** As a multi-channel seller, I want the sales channel (Meesho/Flipkart/Offline) displayed on the invoice, so that I can track which platform the sale originated from when reviewing printed invoices.

#### Acceptance Criteria

1. WHEN the sale has a sales channel tag assigned, THE Invoice_Generator SHALL display the sales channel name (e.g., "Meesho", "Flipkart", "Offline") in the invoice header section
2. WHEN the sale does not have a sales channel tag, THE Invoice_Generator SHALL display "Offline" as the default channel label on the invoice
3. THE Invoice_Generator SHALL display the sales channel as a distinct visual label (badge-style) in the invoice header, distinguishable from other header text
4. THE Invoice_Generator SHALL also display the sale reference number (order ID from marketplace) on the invoice when available, labeled as "Order Ref"

### Requirement 7: Single Invoice PDF Generation

**User Story:** As a seller, I want to generate and download a single invoice PDF for any completed sale, so that I can share it with the buyer or keep it for my records.

#### Acceptance Criteria

1. WHEN a user requests invoice generation for a sale with status COMPLETED, THE Invoice_Generator SHALL produce a valid PDF file containing all required invoice sections (seller details, buyer details, line items with tax, QR code, totals, channel tag)
2. THE Invoice_Generator SHALL generate the PDF within 3 seconds for an invoice with up to 50 line items
3. THE Invoice_Generator SHALL name the downloaded PDF file using the pattern: {invoice_number}.pdf with forward slashes replaced by hyphens (e.g., INV-2024-25-0001.pdf)
4. IF a user requests invoice generation for a sale with status PENDING or CANCELLED, THEN THE Invoice_Generator SHALL reject the request and return an error message indicating that invoices can only be generated for completed sales
5. WHEN a user requests re-generation of an existing invoice (sale already has invoice number), THE Invoice_Generator SHALL regenerate the PDF using the existing invoice number (not create a new number)
6. THE Invoice_Generator SHALL produce a PDF conforming to PDF/A standard for long-term archival
7. THE Invoice_Generator SHALL render the invoice on A4 page size (210mm x 297mm) with standard margins

### Requirement 8: Bulk Invoice Download

**User Story:** As a seller, I want to download multiple invoices at once as a ZIP file, so that I can batch-process invoices for a period or a specific set of orders without downloading them one by one.

#### Acceptance Criteria

1. WHEN a user selects multiple sales and requests bulk invoice download, THE Bulk_Download_Service SHALL generate individual PDF invoices for each selected sale and package them into a single ZIP file
2. THE Bulk_Download_Service SHALL only include sales with status COMPLETED in the bulk download; sales with PENDING or CANCELLED status SHALL be skipped with a summary indicating skipped count
3. THE Bulk_Download_Service SHALL name the ZIP file using the pattern: invoices_{date_range_start}_{date_range_end}.zip using YYYYMMDD format (e.g., invoices_20240401_20240430.zip)
4. THE Bulk_Download_Service SHALL support bulk download of up to 100 invoices in a single ZIP request
5. IF the user selects more than 100 sales for bulk download, THEN THE Bulk_Download_Service SHALL reject the request and display a message indicating the maximum limit of 100 invoices per download
6. THE Bulk_Download_Service SHALL complete ZIP generation within 60 seconds for up to 100 invoices
7. WHEN generating bulk invoices, THE Bulk_Download_Service SHALL assign invoice numbers to sales that do not already have one, maintaining sequential ordering by sale date
8. IF any individual invoice generation fails within a bulk operation, THEN THE Bulk_Download_Service SHALL continue processing remaining invoices, include successfully generated PDFs in the ZIP, and return a summary listing failed sale IDs with error reasons

### Requirement 9: Invoice Template Customization

**User Story:** As a seller, I want to customize my invoice appearance (logo, colors, terms & conditions), so that my invoices reflect my brand identity and include my business-specific terms.

#### Acceptance Criteria

1. THE Template_Engine SHALL allow configuration of the following invoice template settings per company: header background color (hex code), accent color for borders and lines (hex code), and font selection (from predefined options: Roboto, Open Sans, Lato)
2. WHEN the company profile has a logo, THE Template_Engine SHALL place the logo in the top-left corner of the invoice header, scaled to fit within 150x60 pixels while maintaining aspect ratio
3. THE Template_Engine SHALL allow configuration of custom "Terms & Conditions" text (up to 500 characters) displayed in the invoice footer section
4. THE Template_Engine SHALL allow configuration of custom "Notes/Bank Details" text (up to 300 characters) displayed above the Terms & Conditions section for payment instructions
5. WHEN template settings are not configured, THE Template_Engine SHALL use default values: white header background (#FFFFFF), dark blue accent (#1a237e), Roboto font, and empty Terms & Conditions
6. THE Template_Engine SHALL apply template settings at the time of PDF generation — changes to template settings do not alter previously generated invoice PDFs
7. THE Template_Engine SHALL store template configuration in the database linked to the company record

### Requirement 10: Buyer Address Field Extension

**User Story:** As a seller, I want to record buyer billing address for each sale, so that the invoice can display complete buyer details as required by GST rules.

#### Acceptance Criteria

1. THE Invoice_Generator SHALL require a buyerAddress field on the sales table containing the buyer's billing address (street, city, state, pincode) as a single text field (up to 500 characters)
2. WHEN creating or editing a sale, THE Invoice_Generator SHALL provide a text area for entering buyer billing address
3. THE Invoice_Generator SHALL allow the buyerAddress field to be empty (nullable) for cases where address is not available (e.g., walk-in customers)
4. WHEN an invoice is generated for a sale with buyer address populated, THE Invoice_Generator SHALL display the full address in the "Bill To" section of the invoice
5. THE Invoice_Generator SHALL display the buyer address formatted across multiple lines on the invoice (line breaks at commas or explicit newline characters in the stored address)

### Requirement 11: Invoice Storage and Retrieval

**User Story:** As a seller, I want generated invoices stored and accessible for future re-download, so that I do not need to regenerate invoices and can maintain a history of all issued invoices.

#### Acceptance Criteria

1. THE Invoice_Generator SHALL store invoice metadata in an invoices table: invoice_id, sale_id, company_id, invoice_number, financial_year, generated_at timestamp, and invoice_status (ACTIVE, CANCELLED)
2. WHEN a user requests a previously generated invoice, THE Invoice_Generator SHALL regenerate the PDF from current sale data using the stored invoice number (re-render, not stored PDF binary)
3. THE Invoice_Generator SHALL provide a list view of all generated invoices for a company, filterable by financial year, date range, sales channel, and invoice status
4. WHEN a sale is CANCELLED after invoice generation, THE Invoice_Generator SHALL mark the invoice status as CANCELLED but retain the invoice record and invoice number (the number SHALL NOT be reused)
5. THE Invoice_Generator SHALL support searching invoices by invoice number, customer name, or buyer GSTIN
6. THE Invoice_Generator SHALL display invoice generation history showing: invoice number, sale date, customer name, total amount, sales channel, and status for each record

