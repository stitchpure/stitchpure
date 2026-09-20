# Requirements Document

## Introduction

This document defines the requirements for the Manufacturing Cost Management Frontend — a set of dashboard pages that enable companies to manage production batches, expenses, and product cost sheets through the existing Next.js App Router application. The backend API is fully implemented and provides CRUD endpoints for all three entities with role-based access control (OWNER/MANAGER can write; STAFF is read-only).

The frontend integrates into the existing dashboard layout, following established patterns: paginated tables, modal-based forms, toast notifications, confirmation dialogs, skeleton loading states, and role-guarded write actions. All pages are built using React 19, Tailwind CSS v4, and TypeScript, consuming the same-origin `/api/**` endpoints via the existing `apiClient` module.

---

## Glossary

- **Dashboard**: The protected main application area accessible only to authenticated users, containing the sidebar and content area.
- **Sidebar**: The persistent left-side navigation component rendered within the Dashboard layout.
- **Manufacturing_Section**: A grouped navigation section within the Sidebar containing links to Production Batches, Expenses, and Cost Sheets pages.
- **Production_Batches_Page**: The page listing all production batches for the authenticated user's company with pagination.
- **Batch_Detail_Page**: The page displaying a single production batch's full details including status, quantities, and cost breakdown.
- **Expenses_Page**: The page listing all expenses for the authenticated user's company with pagination and filtering.
- **Cost_Sheets_Page**: The page listing all product cost sheets for the authenticated user's company with pagination and filtering.
- **Cost_Sheet_Detail_Page**: The page displaying a single product cost sheet's per-unit cost breakdown.
- **Batch_Status**: The lifecycle state of a production batch: DRAFT, IN_PROGRESS, COMPLETED, or CANCELLED.
- **Cost_Sheet_Status**: The lifecycle state of a product cost sheet: DRAFT, ACTIVE, or ARCHIVED.
- **Expense_Category**: An enumeration of expense types: MATERIAL, LABOUR, PACKAGING, OVERHEAD, TRANSPORT, OTHER.
- **Role_Guard**: The UI-level mechanism that hides write action buttons from STAFF-role users.
- **API_Client**: The existing frontend module for making authenticated HTTP requests to `/api/**` endpoints.
- **Toast**: A transient notification message indicating success or error outcomes.
- **Confirmation_Dialog**: A modal overlay requiring explicit user confirmation before a destructive action.
- **Status_Badge**: A colored inline label visually communicating the state of a record.
- **Pagination_Control**: A UI component for navigating through paginated list results.
- **Skeleton**: A placeholder loading animation rendered while data is being fetched.
- **Cost_Breakdown**: A summary view showing per-category costs (material, labour, overhead, packaging, transport, other) and total/per-unit calculations for a completed batch.

---

## Requirements

---

### Requirement 1: Sidebar Navigation — Manufacturing Section

**User Story:** As an authenticated user, I want to see Manufacturing section links in the sidebar, so that I can navigate to production batches, expenses, and cost sheets pages.

#### Acceptance Criteria

1. THE Sidebar SHALL render a non-clickable "Manufacturing" text label styled as a section header, positioned after the "Stock Ledger" link and before any owner-only links (Users, Company).
2. THE Manufacturing_Section SHALL display three navigation links in the following top-to-bottom order: "Production Batches" (href: `/production-batches`), "Expenses" (href: `/expenses`), and "Cost Sheets" (href: `/cost-sheets`).
3. WHILE a user is viewing a page whose path matches or is a sub-path of a Manufacturing_Section link's href, THE Sidebar SHALL apply the existing active-link style (bg-indigo-700 with white text and aria-current="page") to that link.
4. THE Manufacturing_Section text label and its three navigation links SHALL be visible to all authenticated users regardless of role (OWNER, MANAGER, STAFF).
5. IF a user clicks a Manufacturing_Section link, THEN THE Sidebar SHALL navigate to the corresponding page and render only that single link as active within the Manufacturing_Section.

---

### Requirement 2: Production Batches — List Page

**User Story:** As an authenticated user, I want to view a paginated list of production batches, so that I can monitor manufacturing cycles.

#### Acceptance Criteria

1. WHEN a user navigates to the Production_Batches_Page, THE Dashboard SHALL fetch and display a paginated table of production batches from `GET /api/production-batches` with a default page size of 20, showing batch number, product name, status, planned quantity, good quantity, and start date.
2. THE Production_Batches_Page SHALL render Status_Badges for each batch status: DRAFT (gray), IN_PROGRESS (yellow), COMPLETED (green), CANCELLED (red).
3. THE Production_Batches_Page SHALL render Pagination_Controls when the total number of batches exceeds the page size of 20.
4. WHILE the batch list is loading, THE Production_Batches_Page SHALL render Skeleton placeholders in the table rows.
5. WHEN the batch list fetch returns an empty result, THE Production_Batches_Page SHALL display an empty-state message indicating no batches exist.
6. IF the batch list fetch fails, THEN THE Production_Batches_Page SHALL display an inline error message with a retry button that re-triggers the fetch.
7. WHEN a user clicks a batch row, THE Production_Batches_Page SHALL navigate to the Batch_Detail_Page at `/production-batches/[id]` for that batch.

---

### Requirement 3: Production Batches — Create

**User Story:** As a manager or owner, I want to create a new production batch, so that I can start tracking a manufacturing cycle.

#### Acceptance Criteria

1. WHERE the authenticated user's role is MANAGER or OWNER, THE Production_Batches_Page SHALL render a "Create Batch" button.
2. WHEN the user clicks the "Create Batch" button, THE Production_Batches_Page SHALL open a modal form with fields: product selection (required), product item/SKU selection (optional), planned quantity (required, integer, minimum 1, maximum 999999), and start date (required, date picker).
3. THE create batch form SHALL populate the product selection dropdown by fetching products from `GET /api/products`.
4. WHEN a product is selected, THE create batch form SHALL populate the product item/SKU dropdown by fetching product items for that product; IF the selected product has no product items, THEN the dropdown SHALL display a "No SKUs available" placeholder and remain disabled.
5. WHEN the user submits the form with valid data, THE API_Client SHALL POST to `/api/production-batches` and THE Dashboard SHALL display a success Toast, close the modal, and refresh the batches list.
6. IF the batch creation API returns a non-2xx response, THEN THE Dashboard SHALL display an error Toast containing the API error message and the modal SHALL remain open with user-entered data preserved.
7. WHILE the create request is in flight, THE create batch form SHALL disable the submit button and display a loading indicator.
8. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render the "Create Batch" button.
9. IF the user submits the form with any required field empty or planned quantity less than 1, THEN THE create batch form SHALL display inline validation messages below each invalid field and SHALL NOT submit the request to the API.
10. WHEN the user clicks a cancel button or the modal close control, THE Production_Batches_Page SHALL close the modal and discard any entered form data.

---

### Requirement 4: Production Batches — Detail and Status Transitions

**User Story:** As an authenticated user, I want to view batch details and transition its status, so that I can manage the production lifecycle.

#### Acceptance Criteria

1. WHEN a user navigates to the Batch_Detail_Page, THE Dashboard SHALL fetch batch data from `GET /api/production-batches/[id]` and display batch number, product name, SKU (if applicable), status, planned quantity, produced quantity, good quantity, rejected quantity, start date, and completion date.
2. IF the batch data fetch returns a non-2xx response or the batch is not found, THEN THE Batch_Detail_Page SHALL display an inline error message with the API error text and a retry option instead of the batch detail content.
3. THE Batch_Detail_Page SHALL render a Status_Badge for the current batch status using distinct visual styles for each of the four statuses: DRAFT, IN_PROGRESS, COMPLETED, and CANCELLED.
4. WHERE the batch status is DRAFT and the user role is MANAGER or OWNER, THE Batch_Detail_Page SHALL render a "Start Production" button that submits a PATCH to `/api/production-batches/[id]` with `status: "IN_PROGRESS"`.
5. WHERE the batch status is IN_PROGRESS and the user role is MANAGER or OWNER, THE Batch_Detail_Page SHALL render a "Complete Batch" button that submits a PATCH to `/api/production-batches/[id]` with `status: "COMPLETED"`.
6. WHERE the batch status is IN_PROGRESS and the user role is MANAGER or OWNER, THE Batch_Detail_Page SHALL render a "Cancel Batch" button that shows a Confirmation_Dialog before submitting a PATCH with `status: "CANCELLED"`.
7. WHERE the authenticated user's role is STAFF, THE Batch_Detail_Page SHALL not render any status transition action buttons.
8. WHEN a status transition succeeds, THE Dashboard SHALL display a success Toast and re-fetch the batch data from the API to update the detail view.
9. IF the API returns HTTP 422 when completing a batch (goodQuantity is zero), THEN THE Batch_Detail_Page SHALL display an error Toast with the validation message from the API response.
10. IF the API returns HTTP 409 for an invalid operation, THEN THE Batch_Detail_Page SHALL display an error Toast with the conflict message.
11. IF a status transition request fails with any other non-2xx response not covered by criteria 9 or 10, THEN THE Batch_Detail_Page SHALL display an error Toast with the error message from the API response.
12. WHILE a status transition request is in flight, THE Batch_Detail_Page SHALL disable all action buttons and display a spinner indicator on the triggered button.
13. WHERE the batch status is COMPLETED, THE Batch_Detail_Page SHALL display the Cost_Breakdown section showing material cost, labour cost, overhead cost, packaging cost, transport cost, other cost, total manufacturing cost, and cost per unit as returned by the API response.
14. WHERE the batch status is not COMPLETED, THE Batch_Detail_Page SHALL not render the Cost_Breakdown section.

---

### Requirement 5: Production Batches — Edit and Delete

**User Story:** As a manager or owner, I want to edit batch quantities and delete draft batches, so that I can correct data and remove unused batches.

#### Acceptance Criteria

1. WHERE the batch status is DRAFT or IN_PROGRESS and the user role is MANAGER or OWNER, THE Batch_Detail_Page SHALL render an "Edit" button that opens a modal form pre-populated with the batch's current data.
2. THE edit batch form SHALL allow modification of: planned quantity (integer, minimum 1), produced quantity (integer, minimum 0), good quantity (integer, minimum 0), rejected quantity (integer, minimum 0), and notes (text, maximum 1000 characters).
3. IF the user submits the edit form with produced quantity not equal to the sum of good quantity and rejected quantity (when all three fields are provided), THEN THE edit batch form SHALL display a validation error indicating the quantity mismatch and prevent submission.
4. WHILE the edit form submission is in flight, THE edit batch form SHALL display a loading indicator and disable the submit button to prevent duplicate submissions.
5. WHEN the user submits the edit form with valid data, THE API_Client SHALL PATCH `/api/production-batches/[id]` with only the changed fields and THE Dashboard SHALL display a success Toast and refresh the batch detail view.
6. IF the batch edit API returns a non-2xx response, THEN THE Dashboard SHALL display an error Toast containing the API error message.
7. WHERE the batch status is DRAFT and the user role is MANAGER or OWNER, THE Batch_Detail_Page SHALL render a "Delete" button that shows a Confirmation_Dialog displaying the batch number before submitting a DELETE to `/api/production-batches/[id]`.
8. WHEN the batch deletion succeeds, THE Dashboard SHALL display a success Toast and navigate back to the Production_Batches_Page.
9. IF the batch deletion API returns HTTP 409, THEN THE Dashboard SHALL display an error Toast indicating the batch cannot be deleted in its current status.
10. IF the batch deletion API returns a non-2xx response other than HTTP 409, THEN THE Dashboard SHALL display an error Toast containing the API error message.
11. WHERE the batch status is COMPLETED or CANCELLED, THE Batch_Detail_Page SHALL not render "Edit" or "Delete" buttons.
12. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render "Edit" or "Delete" buttons.

---

### Requirement 6: Production Batches — Linked Expenses

**User Story:** As an authenticated user, I want to see expenses linked to a production batch, so that I can understand what costs contribute to the batch total.

#### Acceptance Criteria

1. THE Batch_Detail_Page SHALL display a "Batch Expenses" section listing expenses fetched from `GET /api/production-batches/[id]/expenses`.
2. THE batch expenses list SHALL display each expense's name, category, amount (formatted to 2 decimal places), date, and includeInManufacturingCost status.
3. WHILE the batch expenses are loading, THE Batch_Detail_Page SHALL render Skeleton placeholders in the expenses section.
4. WHEN the batch expenses fetch returns an empty result, THE Batch_Detail_Page SHALL display a message indicating no expenses are linked to the batch.
5. IF the total number of linked expenses exceeds 20 items per page, THEN THE batch expenses list SHALL render Pagination_Controls allowing navigation between pages using page and limit query parameters.
6. IF the batch expenses fetch returns a non-2xx response, THEN THE Batch_Detail_Page SHALL display an inline error message in the expenses section and provide a retry action to re-fetch the data.

---

### Requirement 7: Expenses — List Page

**User Story:** As an authenticated user, I want to view a paginated and filterable list of expenses, so that I can review all manufacturing costs.

#### Acceptance Criteria

1. WHEN a user navigates to the Expenses_Page, THE Dashboard SHALL fetch and display a paginated table of expenses from `GET /api/expenses` with a default page size of 20, showing name, category, amount (formatted to 2 decimal places), expense date, linked batch number (or dash if unlinked), and includeInManufacturingCost status.
2. THE Expenses_Page SHALL render a batch filter dropdown populated from `GET /api/production-batches` that, WHEN a batch is selected, re-fetches the expenses list filtered by that productionBatchId and resets pagination to page 1.
3. THE Expenses_Page SHALL render a category filter dropdown containing the values MATERIAL, LABOUR, PACKAGING, OVERHEAD, TRANSPORT, OTHER that, WHEN a category is selected, re-fetches the expenses list filtered by that category and resets pagination to page 1.
4. THE Expenses_Page SHALL render Pagination_Controls when the total number of expenses exceeds the page size of 20.
5. WHILE the expense list is loading, THE Expenses_Page SHALL render Skeleton placeholders in the table rows.
6. WHEN the expense list fetch returns an empty result, THE Expenses_Page SHALL display an empty-state message indicating no expenses match the current filter criteria.
7. IF the expense list fetch fails, THEN THE Expenses_Page SHALL display an inline error message with a retry button that re-triggers the fetch with the same filter parameters.

---

### Requirement 8: Expenses — Create, Edit, and Delete

**User Story:** As a manager or owner, I want to create, edit, and delete expenses, so that I can track manufacturing costs accurately.

#### Acceptance Criteria

1. WHERE the authenticated user's role is MANAGER or OWNER, THE Expenses_Page SHALL render a "Create Expense" button.
2. WHEN the user clicks the "Create Expense" button, THE Expenses_Page SHALL open a modal form with fields: name (required, 1–255 characters), amount (required, numeric, range 0.01 to 99999999999999.99), category (required, select from Expense_Category values: MATERIAL, LABOUR, PACKAGING, OVERHEAD, TRANSPORT, OTHER), expense date (required), production batch (optional, select from existing batches), notes (optional, max 2000 characters), and includeInManufacturingCost (checkbox, default true).
3. WHEN the user submits the create form with valid data, THE API_Client SHALL POST to `/api/expenses` and THE Dashboard SHALL display a success Toast, close the modal, and refresh the expenses list.
4. IF the expense creation API returns HTTP 409 (duplicate expense on batch), THEN THE Dashboard SHALL display an error Toast indicating the duplicate conflict and SHALL keep the modal open with form data preserved.
5. IF the expense creation API returns HTTP 400 (validation error), THEN THE Dashboard SHALL display an error Toast with the validation message and SHALL keep the modal open with form data preserved.
6. WHERE the authenticated user's role is MANAGER or OWNER, THE Expenses_Page SHALL render an "Edit" action per expense row that opens a modal form pre-populated with the expense's current data.
7. WHEN the user submits the edit form with valid data, THE API_Client SHALL PATCH `/api/expenses/[id]` and THE Dashboard SHALL display a success Toast, close the modal, and refresh the expenses list.
8. WHERE the authenticated user's role is MANAGER or OWNER, THE Expenses_Page SHALL render a "Delete" action per expense row that shows a Confirmation_Dialog displaying the expense name before submitting a DELETE to `/api/expenses/[id]`.
9. WHEN the expense deletion succeeds, THE Dashboard SHALL display a success Toast and refresh the expenses list.
10. IF any expense operation fails with a non-2xx response, THEN THE Dashboard SHALL display an error Toast containing the API error message.
11. WHILE any expense write request is in flight, THE form SHALL disable the submit button and display a loading indicator.
12. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render "Create Expense", "Edit", or "Delete" action controls.
13. IF the user submits the create or edit form with invalid data (name empty or exceeding 255 characters, amount outside 0.01–99999999999999.99, missing required fields), THEN THE form SHALL display inline validation errors beneath the invalid fields and SHALL NOT submit the request to the API.
14. IF the edit form API request returns HTTP 409 or HTTP 400, THEN THE Dashboard SHALL display an error Toast with the API error message and SHALL keep the modal open with form data preserved.

---

### Requirement 9: Product Cost Sheets — List Page

**User Story:** As an authenticated user, I want to view a filterable list of product cost sheets, so that I can review manufacturing cost history per product.

#### Acceptance Criteria

1. WHEN a user navigates to the Cost_Sheets_Page, THE Dashboard SHALL fetch and display a paginated table of cost sheets from `GET /api/product-cost-sheets` with a default page size of 20, showing product name, SKU code (displayed when the cost sheet has an associated productItemId, otherwise the SKU column SHALL display a dash), total manufacturing cost per unit, status, and effective date, ordered by effective date descending.
2. THE Cost_Sheets_Page SHALL render a product filter control that, WHEN a product is selected, re-fetches the cost sheets list filtered to that product and resets pagination to page 1.
3. THE Cost_Sheets_Page SHALL render Status_Badges for each cost sheet status (DRAFT, ACTIVE, ARCHIVED).
4. THE Cost_Sheets_Page SHALL render Pagination_Controls when the total number of cost sheets exceeds the page size of 20.
5. WHILE the cost sheets list is loading, THE Cost_Sheets_Page SHALL render Skeleton placeholders in the table rows.
6. WHEN the cost sheets fetch returns an empty result, THE Cost_Sheets_Page SHALL display an empty-state message indicating no cost sheets match the current filter criteria.
7. IF the cost sheets fetch fails, THEN THE Cost_Sheets_Page SHALL display an inline error message describing the failure and a retry button that re-triggers the fetch with the same parameters.
8. WHEN a user clicks a cost sheet row, THE Cost_Sheets_Page SHALL navigate to the Cost_Sheet_Detail_Page at `/cost-sheets/[id]` for that cost sheet.

---

### Requirement 10: Product Cost Sheets — Create

**User Story:** As a manager or owner, I want to create a cost sheet from a completed batch, so that I can record the per-unit manufacturing cost for a product.

#### Acceptance Criteria

1. WHERE the authenticated user's role is MANAGER or OWNER, THE Cost_Sheets_Page SHALL render a "Create Cost Sheet" button.
2. WHEN the user clicks the "Create Cost Sheet" button, THE Cost_Sheets_Page SHALL open a modal form with fields: production batch selection (required, dropdown displaying batch number and product name for each entry, filtered to COMPLETED batches only) and effective date (required, date picker accepting any valid date).
3. WHEN the create cost sheet modal opens, THE create cost sheet form SHALL populate the batch selection dropdown by fetching batches with status COMPLETED from `GET /api/production-batches`; IF the response contains zero completed batches, THEN THE form SHALL display an empty-state message indicating no completed batches are available and SHALL disable the submit button.
4. IF the user attempts to submit the form with any required field empty, THEN THE create cost sheet form SHALL display inline validation errors on the empty fields and SHALL NOT send a request to the API.
5. WHEN the user submits the form with all required fields populated, THE API_Client SHALL POST to `/api/product-cost-sheets` and, upon receiving a 2xx response, THE Dashboard SHALL display a success Toast, close the modal, and refresh the cost sheets list.
6. IF the cost sheet creation API returns HTTP 422 (batch not completed), THEN THE Dashboard SHALL display an error Toast with the validation message and the modal SHALL remain open.
7. IF the cost sheet creation API returns a non-2xx response other than 422, THEN THE Dashboard SHALL display an error Toast containing the API error message and the modal SHALL remain open.
8. WHILE the create request is in flight, THE create cost sheet form SHALL disable the submit button and display a loading indicator.
9. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render the "Create Cost Sheet" button.

---

### Requirement 11: Product Cost Sheets — Detail and Status Management

**User Story:** As an authenticated user, I want to view cost sheet details and activate or archive sheets, so that I can manage which cost sheet is current for each product.

#### Acceptance Criteria

1. WHEN a user navigates to the Cost_Sheet_Detail_Page, THE Dashboard SHALL fetch cost sheet data from `GET /api/product-cost-sheets/[id]` and display product name, SKU (if applicable), effective date, status, and a per-unit cost breakdown showing: material cost per unit, labour cost per unit, overhead cost per unit, packaging cost per unit, transport cost per unit, other cost per unit, and total manufacturing cost per unit, with all cost values displayed to 4 decimal places.
2. IF the cost sheet detail fetch returns a non-2xx response, THEN THE Dashboard SHALL display an inline error message with a retry option instead of the detail content.
3. THE Cost_Sheet_Detail_Page SHALL render a Status_Badge for the current cost sheet status using the values DRAFT, ACTIVE, or ARCHIVED.
4. WHERE the cost sheet status is DRAFT and the user role is MANAGER or OWNER, THE Cost_Sheet_Detail_Page SHALL render an "Activate" button that submits a PATCH to `/api/product-cost-sheets/[id]` with `status: "ACTIVE"`.
5. WHERE the cost sheet status is ACTIVE and the user role is MANAGER or OWNER, THE Cost_Sheet_Detail_Page SHALL render an "Archive" button that shows a Confirmation_Dialog before submitting a PATCH with `status: "ARCHIVED"`.
6. WHEN a status change succeeds, THE Dashboard SHALL display a success Toast and refresh the cost sheet detail view.
7. IF the status change API returns a non-2xx response, THEN THE Dashboard SHALL display an error Toast containing the API error message.
8. WHILE a status change request is in flight, THE Cost_Sheet_Detail_Page SHALL disable all action buttons and display a loading state.
9. WHERE the cost sheet status is ARCHIVED, THE Cost_Sheet_Detail_Page SHALL not render "Activate" or "Archive" buttons.
10. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render "Activate" or "Archive" buttons.
11. THE Cost_Sheet_Detail_Page SHALL display the batch number of the production batch the cost sheet was derived from as a hyperlink that navigates to the Batch_Detail_Page for that batch.

---

### Requirement 12: Form Validation and Error Display

**User Story:** As a user, I want clear validation feedback on forms, so that I can correct input errors before and after submission.

#### Acceptance Criteria

1. WHEN a user attempts to submit a form with empty required fields, THE form SHALL display inline validation messages below each empty required field indicating which fields are required, preserve all entered form data, and prevent submission to the API.
2. WHEN a user enters a non-numeric value or a value less than 0.01 in a numeric field (amount, quantity, price), THE form SHALL display an inline validation message below the field indicating the expected numeric format and valid range.
3. WHEN the API returns HTTP 400 with field-level validation errors, THE Dashboard SHALL display the error messages in a Toast listing each specific validation failure returned by the API.
4. WHEN the API returns HTTP 422 with a business rule violation, THE Dashboard SHALL display the error message from the response body in a Toast describing the constraint that was violated.
5. THE form fields SHALL display the `number` input type for quantity, price, and amount fields, and the `date` input type for date fields.
6. WHEN a user corrects a field that previously displayed an inline validation error and attempts to re-submit, THE form SHALL clear the inline validation message for that corrected field.
7. IF a form submission fails due to client-side validation or an API error response, THEN THE form SHALL retain all user-entered data in the form fields without clearing them.

---

### Requirement 13: Loading States and Accessibility

**User Story:** As a user, I want consistent loading states and accessible interfaces, so that the application is usable and inclusive.

#### Acceptance Criteria

1. WHILE any page data fetch is in progress, THE Dashboard SHALL render Skeleton placeholders that correspond in number and position to the content blocks expected in the final rendered view (e.g., one skeleton row per expected table row up to the page size, one skeleton card per stat card).
2. WHILE any form submission is in progress, THE Dashboard SHALL disable the submit button and render text within or adjacent to the button that describes the in-progress action (e.g., "Creating...", "Saving...") replacing the default button label.
3. THE Dashboard SHALL use semantic HTML elements (headings, tables, buttons, form labels) and ARIA attributes including: `aria-busy="true"` on container elements while data is loading, `aria-label` on icon-only buttons, and `aria-required="true"` on mandatory form fields, for all manufacturing cost management pages.
4. THE Dashboard SHALL ensure all interactive elements (buttons, links, form controls) are keyboard-navigable in a tab order that follows the visual reading order (left-to-right, top-to-bottom) without requiring a mouse to operate any functionality.
5. THE Dashboard SHALL render form labels associated with their respective input fields using `htmlFor` and `id` attributes.
6. WHEN a loading state begins or ends, THE Dashboard SHALL announce the state change to assistive technologies using an `aria-live="polite"` region that conveys the loading or completion status.
