# Requirements Document

## Introduction

This feature adds three interconnected capabilities to the stock management e-commerce application: Multi-Channel Listing Management, Barcode Label Generation & Scanning, and Returns Processing. Together, these enable sellers to manage multiple marketplace listings per product (Meesho, Flipkart, Amazon, Offline), generate and scan barcode labels for warehouse operations, and process product returns with stock reconciliation. The primary user sells EVA footwear and dresses across multiple channels with 50+ listings per product at varying prices (₹249–₹399), sharing physical stock across all listings.

## Glossary

- **Listing_Module**: The subsystem responsible for creating, updating, and managing marketplace listings linked to product items
- **Barcode_Generator**: The subsystem responsible for generating Code-128 barcode labels from SKU codes
- **Barcode_Scanner**: The subsystem responsible for scanning barcodes via phone camera using browser-based libraries (html5-qrcode or @zxing/browser)
- **Return_Processor**: The subsystem responsible for handling product returns, verifying items against orders, and reconciling stock
- **Channel**: A sales marketplace platform (Meesho, Flipkart, Amazon, or Offline)
- **Listing**: A marketplace-specific product entry with its own title, price, platform SKU, and URL linked to a physical product item
- **Platform_SKU**: The marketplace-assigned identifier for a listing on a specific channel
- **Return_Condition**: The physical state of a returned product (Good, Damaged, or Wrong_Product)
- **Return_Reason**: The customer-stated reason for returning a product (Size_Issue, Damaged_In_Transit, Changed_Mind, Wrong_Product_Shipped)
- **Stock_Ledger**: The existing transaction log that records all stock movements with quantity changes
- **Product_Item**: An existing SKU-level record representing a specific variant of a product (e.g., EVA Slipper Size 7)
- **Sale**: An existing order record in the sales table representing a customer purchase

## Requirements

### Requirement 1: Listing Creation

**User Story:** As a seller, I want to create marketplace listings linked to my products, so that I can sell the same product across multiple channels with different titles and prices.

#### Acceptance Criteria

1. WHEN a seller submits a valid listing creation request, THE Listing_Module SHALL create a new listing record with id, company_id, product_id, channel, title, listing_price, platform_sku, listing_url, and is_active fields
2. THE Listing_Module SHALL require the channel field to be one of: Meesho, Flipkart, Amazon, or Offline
3. THE Listing_Module SHALL allow multiple listings to reference the same product_id with different titles, prices, and channels
4. THE Listing_Module SHALL validate that the referenced product_id belongs to the seller's company before creating a listing
5. IF a listing creation request contains an invalid product_id, THEN THE Listing_Module SHALL return a 404 error with a descriptive message
6. THE Listing_Module SHALL set is_active to true by default when creating a new listing

### Requirement 2: Listing Management

**User Story:** As a seller, I want to view, update, and deactivate my listings, so that I can maintain accurate marketplace information.

#### Acceptance Criteria

1. WHEN a seller requests the listings list, THE Listing_Module SHALL return a paginated list of listings filtered by company_id
2. WHEN a seller provides a channel filter, THE Listing_Module SHALL return only listings matching that channel
3. WHEN a seller updates a listing, THE Listing_Module SHALL allow modification of title, listing_price, platform_sku, listing_url, and is_active fields
4. WHEN a seller deactivates a listing, THE Listing_Module SHALL set is_active to false without deleting the listing record
5. THE Listing_Module SHALL allow filtering listings by product_id to show all channel listings for a single product

### Requirement 3: Sale-Listing Association

**User Story:** As a seller, I want sales to track which listing and channel an order came from, so that I can analyze per-listing performance.

#### Acceptance Criteria

1. THE Listing_Module SHALL extend the sales table with a channel field (varchar) and a listing_id field (uuid, nullable foreign key to listings)
2. WHEN a sale is created with a listing_id, THE Listing_Module SHALL validate that the listing exists and belongs to the same company
3. WHEN a sale is created without a listing_id, THE Listing_Module SHALL accept the sale with a null listing_id for backward compatibility
4. THE Listing_Module SHALL allow a channel value to be stored on sales independently of listing_id to support orders where the exact listing is unknown

### Requirement 4: Listing Performance Tracking

**User Story:** As a seller, I want to see performance metrics per listing, so that I can identify which listings generate the most profit and which have high return rates.

#### Acceptance Criteria

1. WHEN a seller requests listing performance, THE Listing_Module SHALL compute total orders count per listing from associated sales
2. WHEN a seller requests listing performance, THE Listing_Module SHALL compute total returns count per listing from sales with non-null return_status
3. WHEN a seller requests listing performance, THE Listing_Module SHALL compute profit per listing as sum of (sale total_amount minus product cost)
4. WHEN a seller requests listing performance, THE Listing_Module SHALL compute return rate per listing as returns count divided by total orders count

### Requirement 5: Barcode Label Generation

**User Story:** As a warehouse operator, I want to generate barcode labels from SKU codes, so that I can label products for quick identification and scanning.

#### Acceptance Criteria

1. WHEN a product item SKU is provided, THE Barcode_Generator SHALL generate a Code-128 format barcode image for that SKU
2. THE Barcode_Generator SHALL render the label at 50mm × 25mm dimensions suitable for thermal printers
3. THE Barcode_Generator SHALL display the SKU code as human-readable text below the barcode
4. THE Barcode_Generator SHALL display the product name on the label
5. THE Barcode_Generator SHALL display size or variant information on the label
6. THE Barcode_Generator SHALL exclude price information from the label
7. WHEN a seller requests batch label generation, THE Barcode_Generator SHALL generate labels for multiple product items in a single printable page

### Requirement 6: Barcode Label Printing

**User Story:** As a warehouse operator, I want to print barcode labels using my thermal printer, so that I can physically label products.

#### Acceptance Criteria

1. WHEN a seller triggers label printing, THE Barcode_Generator SHALL open the browser print dialog with the label content formatted for thermal printers
2. THE Barcode_Generator SHALL format the print layout with 50mm × 25mm label dimensions using CSS print media queries
3. THE Barcode_Generator SHALL support printing multiple labels per page with appropriate spacing and page breaks

### Requirement 7: Barcode Scanning

**User Story:** As a warehouse operator, I want to scan product barcodes using my phone camera, so that I can quickly identify products without manual SKU entry.

#### Acceptance Criteria

1. WHEN the camera is activated, THE Barcode_Scanner SHALL request camera permission from the browser and display the camera feed
2. WHEN a Code-128 barcode is detected in the camera feed, THE Barcode_Scanner SHALL decode the barcode and extract the SKU value
3. WHEN a barcode is successfully scanned, THE Barcode_Scanner SHALL look up the corresponding product item by SKU
4. IF a scanned barcode does not match any existing SKU, THEN THE Barcode_Scanner SHALL display an error message indicating the SKU was not found
5. THE Barcode_Scanner SHALL provide visual and audio feedback upon successful scan detection

### Requirement 8: Barcode-Assisted Sale Creation

**User Story:** As a seller, I want to scan a barcode to auto-fill the product item during sale creation, so that I can process orders faster.

#### Acceptance Criteria

1. WHEN a barcode is scanned during sale creation, THE Barcode_Scanner SHALL auto-fill the product item field with the matching SKU's product_item_id
2. WHEN a barcode is scanned during sale creation, THE Barcode_Scanner SHALL display the product name, variant, and current stock level for confirmation
3. WHEN multiple items need to be added to a sale, THE Barcode_Scanner SHALL allow consecutive scans to add multiple line items

### Requirement 9: Barcode-Assisted Packing Verification

**User Story:** As a warehouse operator, I want to scan barcodes during packing to verify items against the order, so that I can prevent shipping wrong products.

#### Acceptance Criteria

1. WHEN a packing verification session is started for a sale, THE Barcode_Scanner SHALL display the list of expected items from the sale
2. WHEN a barcode is scanned during packing verification, THE Barcode_Scanner SHALL match the scanned SKU against the expected items list
3. WHEN a scanned item matches an expected item, THE Barcode_Scanner SHALL mark that item as verified with a visual indicator
4. IF a scanned item does not match any expected item in the sale, THEN THE Barcode_Scanner SHALL display a mismatch warning
5. WHEN all expected items are verified, THE Barcode_Scanner SHALL display a completion confirmation

### Requirement 10: Barcode-Assisted Stock Counting

**User Story:** As a warehouse operator, I want to scan barcodes during stock counting, so that I can quickly take inventory without manual data entry.

#### Acceptance Criteria

1. WHEN a stock counting session is started, THE Barcode_Scanner SHALL maintain a running count of scanned items grouped by SKU
2. WHEN a barcode is scanned during stock counting, THE Barcode_Scanner SHALL increment the count for that SKU by one
3. WHEN a stock counting session is completed, THE Barcode_Scanner SHALL display the counted quantities alongside current system stock levels for comparison
4. WHEN discrepancies are found between counted and system stock, THE Barcode_Scanner SHALL highlight the mismatched items

### Requirement 11: Return Initiation

**User Story:** As a seller, I want to initiate a return from the sale detail page, so that I can process customer returns efficiently.

#### Acceptance Criteria

1. WHEN a seller views a completed sale, THE Return_Processor SHALL display a "Process Return" button
2. WHILE a sale has status PENDING or CANCELLED, THE Return_Processor SHALL hide the "Process Return" button
3. WHEN the "Process Return" button is clicked, THE Return_Processor SHALL open the return processing flow
4. THE Return_Processor SHALL extend the sales table with return_status (varchar, nullable), return_reason (varchar, nullable), return_condition (varchar, nullable), and returned_at (timestamp, nullable) fields

### Requirement 12: Return Verification via Barcode

**User Story:** As a warehouse operator, I want to scan the returned product's barcode and verify it against the original order, so that I can confirm the correct product was returned.

#### Acceptance Criteria

1. WHEN the return flow is started for a sale, THE Return_Processor SHALL activate the barcode scanner
2. WHEN a barcode is scanned during return processing, THE Return_Processor SHALL compare the scanned SKU against the sale items
3. WHEN the scanned SKU matches a sale item, THE Return_Processor SHALL proceed to condition selection
4. IF the scanned SKU does not match any item in the original sale, THEN THE Return_Processor SHALL display a mismatch error and prompt to re-scan or select "Wrong product" condition

### Requirement 13: Return Condition Assessment

**User Story:** As a seller, I want to record the condition of returned products, so that I can decide whether to restock them.

#### Acceptance Criteria

1. WHEN a returned product is verified, THE Return_Processor SHALL present condition options: Good, Damaged, and Wrong_Product
2. WHEN the condition is set to Good, THE Return_Processor SHALL add one unit to stock via a stock_ledger entry with movement_type RETURN
3. WHEN the condition is set to Damaged, THE Return_Processor SHALL record the return without adding stock and mark the quantity as a loss
4. WHEN the condition is set to Wrong_Product, THE Return_Processor SHALL record the return without adding stock to the original item's inventory
5. THE Return_Processor SHALL require a return_reason selection: Size_Issue, Damaged_In_Transit, Changed_Mind, or Wrong_Product_Shipped

### Requirement 14: Return Status Tracking

**User Story:** As a seller, I want to track the return status of sales, so that I can monitor return patterns.

#### Acceptance Criteria

1. WHEN a return is processed, THE Return_Processor SHALL update the sale's return_status to "RETURNED"
2. WHEN a return is processed, THE Return_Processor SHALL record the returned_at timestamp
3. WHEN a return is processed, THE Return_Processor SHALL store the selected return_reason and return_condition on the sale record
4. THE Return_Processor SHALL allow filtering sales by return_status to view all returned orders

### Requirement 15: Listing-Wise Return Rate Reports

**User Story:** As a seller, I want to see return rates broken down by listing, so that I can identify problematic listings and take corrective action.

#### Acceptance Criteria

1. WHEN a seller requests the return rate report, THE Return_Processor SHALL compute return count and return rate for each listing
2. WHEN a seller requests the return rate report, THE Return_Processor SHALL break down returns by return_reason per listing
3. WHEN a seller requests the return rate report, THE Return_Processor SHALL break down returns by return_condition per listing
4. THE Return_Processor SHALL sort listings by return rate in descending order by default

### Requirement 16: Stock Ledger Return Entry

**User Story:** As a seller, I want returns in good condition to automatically restore stock, so that inventory levels stay accurate without manual adjustments.

#### Acceptance Criteria

1. WHEN a return with condition Good is processed, THE Return_Processor SHALL create a stock_ledger entry with movement_type RETURN, referencing the sale_id
2. WHEN a return with condition Good is processed, THE Return_Processor SHALL increment the product_item's stock by the returned quantity
3. THE Return_Processor SHALL require the movement_type enum in stock_ledger to include a RETURN value
4. WHEN a return with condition Damaged or Wrong_Product is processed, THE Return_Processor SHALL create no stock_ledger entry for stock addition
