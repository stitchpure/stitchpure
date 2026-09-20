# Requirements Document

## Introduction

This document defines the requirements for the Product Storefront — a public-facing page that displays products from all registered companies on a single, unified storefront. Any visitor (no login required) can browse products and contact companies via Call or Send Query CTAs. Companies control product visibility and set wholesale per-piece pricing for storefront display through a dashboard management interface.

The storefront is built within the existing Next.js App Router application using a new public route group. The dashboard gains a storefront management section where companies toggle product visibility and set wholesale prices.

---

## Glossary

- **Storefront**: The public-facing page displaying product cards from all companies, accessible without authentication.
- **Product_Card**: A UI component displaying a single product's details (name, image, description, wholesale price, company name) with contact CTAs.
- **Storefront_Listing**: A database record linking a product to the storefront with visibility control and wholesale pricing set by the owning company.
- **Wholesale_Price**: The per-piece price a company sets for a product's storefront display, independent of internal selling/purchase prices.
- **Call_CTA**: A clickable button on a Product_Card that initiates a phone call to the product's company using the company phone number.
- **Query_CTA**: A clickable button on a Product_Card that opens a contact form or mailto link allowing a visitor to send a purchase inquiry to the company email.
- **Visibility_Toggle**: A dashboard control that allows a company to show or hide a specific product on the Storefront.
- **Storefront_Manager**: The dashboard page where authenticated company users manage which products appear on the Storefront and set wholesale prices.
- **Visitor**: Any user accessing the Storefront page, authenticated or not.
- **Company**: A registered business entity in the system whose products can appear on the Storefront.
- **Product**: A catalog item belonging to a Company, identified by name, description, images, and category.

---

## Requirements

---

### Requirement 1: Public Storefront Page Access

**User Story:** As a visitor, I want to access the product storefront without logging in, so that I can browse available wholesale products freely.

#### Acceptance Criteria

1. THE Storefront SHALL be accessible at a public URL path without requiring authentication, and SHALL NOT redirect unauthenticated visitors to a login page.
2. THE Storefront SHALL render product cards from all companies on a single unified page without company-wise separation.
3. WHEN a Visitor navigates to the Storefront URL, THE Storefront SHALL load and display all products that have an active Storefront_Listing with visibility enabled, where the parent product has `isActive` set to true and the parent company has `isActive` set to true.
4. THE Storefront SHALL not display any product that does not have a Storefront_Listing, whose Storefront_Listing visibility is disabled, whose parent product `isActive` is false, or whose parent company `isActive` is false.
5. THE Storefront SHALL render a responsive product card grid layout on screen widths from 320px (mobile) to 1920px (desktop), with no horizontal overflow, no overlapping elements, and all product card content remaining visible and readable at each breakpoint.
6. WHEN no products with active visible Storefront_Listings exist, THE Storefront SHALL display an empty-state message indicating that no products are currently available.
7. IF the Storefront data fetch fails, THEN THE Storefront SHALL display an error message indicating that products could not be loaded, without exposing internal system details.
8. WHILE product data is being fetched on initial page load, THE Storefront SHALL display a loading indicator.

---

### Requirement 2: Product Card Display

**User Story:** As a visitor, I want to see essential product details on each card, so that I can evaluate products before contacting the seller.

#### Acceptance Criteria

1. THE Product_Card SHALL display the product name (truncated to a maximum of 60 characters with an ellipsis when exceeded), the first product image (at index 0 of the images array) or a generic placeholder image when the images array is empty, the product category name, and the Wholesale_Price with a "per piece" label.
2. THE Product_Card SHALL display the company name that sells the product.
3. IF the product description is not empty, THEN THE Product_Card SHALL display the product description truncated to a maximum of 120 characters with an ellipsis ("…") appended when the full description exceeds 120 characters.
4. IF the product description is null or empty, THEN THE Product_Card SHALL hide the description area without leaving visible blank space in the card layout.
5. WHEN a product has multiple images, THE Product_Card SHALL display only the image at index 0 from the product images array.
6. THE Product_Card SHALL display the Wholesale_Price formatted as Indian Rupee currency with the "₹" symbol prefix and exactly two decimal places (e.g., "₹150.00 per piece").

---

### Requirement 3: Contact CTAs — Call and Send Query

**User Story:** As a visitor, I want to call or send a query to the company selling a product, so that I can inquire about wholesale purchases.

#### Acceptance Criteria

1. THE Product_Card SHALL render a "Call" button and a "Send Query" button below the product details, each visually distinguishable as clickable interactive elements.
2. WHEN a Visitor clicks the Call_CTA, THE Storefront SHALL initiate a phone call using the `tel:` protocol with the selling company's stored phone number as the href value.
3. WHEN a Visitor clicks the Query_CTA, THE Storefront SHALL open the default email client using the `mailto:` protocol with the selling company's email address, a pre-filled subject line in the format "Wholesale Inquiry: {product name}", and an empty body.
4. IF the company has no phone number registered, THEN THE Product_Card SHALL disable the Call_CTA, render it in a visually disabled state that is non-clickable, and display a "Phone not available" tooltip on hover or focus.
5. THE Call_CTA and Query_CTA SHALL be functional without requiring the Visitor to be logged in.
6. THE Call_CTA and Query_CTA SHALL be accessible via keyboard navigation and include descriptive accessible labels indicating the action and target company name.

---

### Requirement 4: Storefront Listing Data Model

**User Story:** As a developer, I want a database structure to track which products are visible on the storefront and their wholesale prices, so that the system can serve the correct data.

#### Acceptance Criteria

1. THE Storefront_Listing SHALL store a UUID primary key, a non-nullable reference to the product (product_id), a non-nullable wholesale per-piece price (wholesale_price), and a non-nullable visibility boolean flag (is_visible) defaulting to false.
2. THE Storefront_Listing SHALL enforce a unique constraint on product_id such that each product has at most one Storefront_Listing record.
3. THE Storefront_Listing SHALL require the wholesale_price to be a numeric(12,2) value between 0.01 and 9,999,999,999.99 inclusive.
4. WHEN a product is deleted, THE Storefront_Listing record for that product SHALL be automatically removed via cascade delete on the product_id foreign key.
5. THE Storefront_Listing SHALL store a created_at timestamp defaulting to the current time and an updated_at timestamp defaulting to the current time, both non-nullable.
6. IF an insert or update attempts to set a product_id that already exists in another Storefront_Listing record, THEN THE System SHALL reject the operation with a unique constraint violation error.

---

### Requirement 5: Company Dashboard — Storefront Management

**User Story:** As a company manager or owner, I want to manage which of my products appear on the storefront and set their wholesale prices, so that I can control my public product catalog.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Storefront_Manager page, THE Dashboard SHALL display a list of all active company products with their current storefront visibility status (defaulting to disabled for products without an existing Storefront_Listing) and wholesale price (displaying empty for products without a Storefront_Listing).
2. WHERE the authenticated user's role is MANAGER or OWNER, THE Storefront_Manager SHALL render a Visibility_Toggle per product that enables or disables the product on the Storefront.
3. WHERE the authenticated user's role is MANAGER or OWNER, THE Storefront_Manager SHALL render an editable Wholesale_Price field per product that accepts a numeric value between 0.01 and 9,999,999.99 with up to two decimal places.
4. WHEN a user toggles visibility or updates the wholesale price, THE Storefront_Manager SHALL disable the corresponding control, submit the change to the API, and display a success Toast within 1 second of receiving a successful API response.
5. IF a storefront listing update fails, THEN THE Storefront_Manager SHALL re-enable the control, revert the field to its previous value, and display an error Toast containing the API error message.
6. THE Storefront_Manager SHALL only display products belonging to the authenticated user's company.
7. WHERE the authenticated user's role is STAFF, THE Storefront_Manager SHALL display storefront listing data as read-only without toggle or edit controls.
8. WHILE the Storefront_Manager is fetching the product list from the API, THE Storefront_Manager SHALL display a loading skeleton placeholder in place of the product table.
9. IF the Wholesale_Price field value is empty or outside the range 0.01 to 9,999,999.99 when the user attempts to enable visibility, THEN THE Storefront_Manager SHALL prevent the toggle and display an inline validation message indicating the required price range.

---

### Requirement 6: Storefront API — Public Product Listing

**User Story:** As a developer, I want an API endpoint that returns all storefront-visible products with their details and company contact information, so that the public storefront page can render them.

#### Acceptance Criteria

1. THE Storefront API SHALL expose a public GET endpoint that returns all products with active Storefront_Listings where visibility is enabled, ordered by Storefront_Listing creation date descending (newest first).
2. THE Storefront API SHALL return for each product: product name, product slug, product description, product images, category name, Wholesale_Price, company name, company phone, and company email.
3. THE Storefront API SHALL only include products whose parent product record has `isActive` set to true and whose parent company has `isActive` set to true.
4. THE Storefront API SHALL not require authentication to access.
5. THE Storefront API SHALL support pagination with `page` and `limit` query parameters, defaulting to page 1 and limit 20, with `limit` clamped to a maximum of 50 and a minimum of 1, and `page` clamped to a minimum of 1.
6. THE Storefront API SHALL return a JSON response containing a `success` boolean, a `data` array of product objects, and a `pagination` object with `page`, `limit`, `total`, and `totalPages` fields.
7. THE Storefront API SHALL support filtering by category via an optional `categoryId` query parameter; WHEN the `categoryId` does not match any category or no products match the filter, THE Storefront API SHALL return a successful response with an empty `data` array and `total` of 0.
8. IF the `page` or `limit` query parameters are non-numeric values, THEN THE Storefront API SHALL return a 400 Bad Request response with an error message indicating invalid pagination parameters.

---

### Requirement 7: Storefront API — Company Dashboard Management

**User Story:** As a developer, I want API endpoints for managing storefront listings, so that the dashboard can create, update, and read storefront data for a company's products.

#### Acceptance Criteria

1. THE Storefront API SHALL expose an authenticated GET endpoint that returns all Storefront_Listings for the authenticated user's company.
2. THE Storefront API SHALL expose an authenticated POST endpoint that creates a Storefront_Listing for a product belonging to the authenticated user's company, accepting Wholesale_Price and visibility flag.
3. THE Storefront API SHALL expose an authenticated PATCH endpoint that updates an existing Storefront_Listing's Wholesale_Price and visibility flag.
4. IF a user attempts to create a Storefront_Listing for a product not belonging to their company, THEN THE Storefront API SHALL return a 403 Forbidden response.
5. IF a user submits a Wholesale_Price that is zero or negative, THEN THE Storefront API SHALL return a 422 Unprocessable Entity response with a descriptive error message.
6. THE Storefront API SHALL require the user role to be MANAGER or OWNER for POST and PATCH operations.

---

### Requirement 8: Storefront Search and Filtering

**User Story:** As a visitor, I want to search and filter products on the storefront, so that I can find relevant products quickly.

#### Acceptance Criteria

1. THE Storefront SHALL render a search input field that filters displayed products by product name.
2. WHEN a Visitor types in the search field and at least 1 character is present, THE Storefront SHALL debounce the input for 300 milliseconds and then filter the product list to show only products whose name contains the search text (case-insensitive match).
3. THE Storefront SHALL render a category filter dropdown populated with an "All Categories" default option followed by all categories that have at least one visible storefront product.
4. WHEN a Visitor selects a category from the filter, THE Storefront SHALL display only products belonging to that category and reset pagination to page 1.
5. WHEN both a search term and a category filter are active, THE Storefront SHALL display products matching both criteria simultaneously.
6. WHEN no products match the applied filters, THE Storefront SHALL display an empty-state message indicating no products were found and suggesting the Visitor adjust or clear filters.
7. WHEN a Visitor selects the "All Categories" default option, THE Storefront SHALL remove the category filter and display products from all categories.
8. WHEN a Visitor applies or changes a search term or category filter, THE Storefront SHALL persist the active filter values as URL search parameters so that the filtered view is shareable and survives page refresh.
9. WHEN a Visitor changes the search term, THE Storefront SHALL reset pagination to page 1.

---

### Requirement 9: Storefront Pagination

**User Story:** As a visitor, I want to navigate through multiple pages of products, so that I can browse the full catalog without overwhelming page load.

#### Acceptance Criteria

1. THE Storefront SHALL display a maximum of 20 product cards per page.
2. WHEN more than 20 visible storefront products exist, THE Storefront SHALL render pagination controls (Previous button, Next button, and page number buttons) below the product grid, with the Previous button disabled on page 1 and the Next button disabled on the last page.
3. WHEN a Visitor navigates to a different page, THE Storefront SHALL update the URL `page` search parameter to the selected page number and fetch and display the corresponding set of 20 (or fewer on the last page) products.
4. THE Storefront SHALL display the total count of matching products and the current page range (e.g., "Showing 1–20 of 85 products").
5. WHILE product data is loading during pagination, THE Storefront SHALL display a loading indicator in place of the product grid.
6. IF a Visitor navigates to an invalid page number (non-numeric, less than 1, or greater than the total number of pages), THEN THE Storefront SHALL default to displaying page 1.
7. WHEN search text or category filter selection changes while the Visitor is on a page other than page 1, THE Storefront SHALL reset pagination to page 1 before fetching results.

---

### Requirement 10: Storefront SEO and Performance

**User Story:** As a business, I want the storefront page to be search-engine friendly and fast loading, so that products get organic visibility online.

#### Acceptance Criteria

1. THE Storefront page SHALL be server-side rendered such that the initial HTML response contains fully rendered product card content (product names, descriptions, prices, and company names) without requiring client-side JavaScript execution.
2. THE Storefront page SHALL include a meta title (maximum 60 characters) containing the storefront name, a meta description (maximum 160 characters) summarizing the product catalog, and Open Graph tags including og:title, og:description, og:image, and og:url populated with storefront-level content.
3. THE Storefront page SHALL apply `loading="eager"` (or no loading attribute) to product images within the first visible viewport and `loading="lazy"` to all product images below the initial viewport.
4. WHEN a product image fails to load, THE Storefront SHALL display a fallback placeholder image that maintains the same dimensions as a successfully loaded product image, preserving the card layout.
5. IF the Storefront page has no products to display, THEN THE Storefront page SHALL still render valid meta title, meta description, and Open Graph tags with default storefront branding content.
