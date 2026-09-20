# Requirements Document

## Introduction

This document defines the requirements for the Stock Management Frontend — a user-friendly dashboard UI built inside the existing Next.js 16 (App Router) project. The backend is fully implemented with JWT authentication and REST APIs. The frontend is a multi-tenant stock management SaaS dashboard that allows business owners, managers, and staff to manage products, categories, SKUs, purchases, sales, stock movements, users, and company settings — all within a clean, responsive, role-aware web interface.

The frontend uses no new npm packages. All pages are built using Next.js App Router, React 19, and Tailwind CSS v4. JWT tokens are stored in localStorage, and all API calls target the same-origin `/api/**` endpoints.

---

## Glossary

- **Dashboard**: The protected main application area, accessible only to authenticated users.
- **Auth_Pages**: Public-facing pages (Login and Register) that do not require authentication.
- **Sidebar**: The persistent left-side navigation component displayed within the Dashboard.
- **API_Client**: The frontend module responsible for making HTTP requests to the same-origin `/api/**` endpoints, attaching JWT tokens.
- **Auth_Store**: The client-side module that persists the JWT token and decoded user/company context in `localStorage`.
- **Toast**: A transient, non-blocking notification message shown to the user to indicate success or error outcomes.
- **Confirmation_Dialog**: A modal overlay requiring explicit user confirmation before a destructive action is executed.
- **Status_Badge**: A colored inline label that visually communicates the state of a record (e.g., ACTIVE, PENDING, RECEIVED).
- **OWNER**: The highest-privileged user role. Has access to all features including user management and company settings.
- **MANAGER**: Mid-level role. Can create and modify products, SKUs, purchases, and sales, but cannot manage users or company settings.
- **STAFF**: Read-only role. Can view all data but cannot create, edit, or delete any records.
- **SKU**: A Product Item — a specific, sellable variant of a product identified by a unique stock-keeping unit code.
- **Stock_Ledger**: An append-only audit log of every stock movement (purchase in, sale out, adjustment).
- **Route_Guard**: A client-side mechanism that redirects unauthenticated users to the login page and authenticated users away from auth pages.
- **Pagination_Control**: A UI component for navigating through paginated list results.
- **Role_Guard**: A UI-level mechanism that hides or disables write actions from STAFF-role users.

---

## Requirements

---

### Requirement 1: Authentication — Login

**User Story:** As a company user, I want to log in with my email and password, so that I can access the stock management dashboard securely.

#### Acceptance Criteria

1. THE Auth_Pages SHALL render a login form containing email and password fields and a submit button.
2. WHEN a user submits the login form with valid credentials, THE Auth_Client SHALL POST to `/api/auth/login`, store the returned JWT in `localStorage`, and redirect the user to the dashboard home page.
3. IF the login API returns a non-2xx response, THEN THE Auth_Pages SHALL display a Toast with the error message from the response body.
4. WHILE the login request is in flight, THE Auth_Pages SHALL display a loading indicator and disable the submit button.
5. IF a user navigates to `/login` while already holding a valid JWT in `localStorage`, THEN THE Route_Guard SHALL redirect the user to the dashboard home page.
6. THE Auth_Pages SHALL render the login form in a centered, card-based layout with no sidebar visible.

---

### Requirement 2: Authentication — Register

**User Story:** As a new business owner, I want to register my company and owner account, so that I can start using the stock management system.

#### Acceptance Criteria

1. THE Auth_Pages SHALL render a registration form with fields for company name, company slug, company email, company phone, owner name, owner email, and owner password.
2. WHEN a user submits the registration form with valid data, THE Auth_Client SHALL POST to `/api/auth/register`, store the returned JWT in `localStorage`, and redirect the user to the dashboard home page.
3. IF the registration API returns a non-2xx response, THEN THE Auth_Pages SHALL display a Toast with the error message from the response body.
4. WHILE the registration request is in flight, THE Auth_Pages SHALL display a loading indicator and disable the submit button.
5. IF a user navigates to `/register` while already holding a valid JWT in `localStorage`, THEN THE Route_Guard SHALL redirect the user to the dashboard home page.
6. THE Auth_Pages SHALL render the registration form in a centered, card-based layout with no sidebar visible.

---

### Requirement 3: Route Guard and Session Management

**User Story:** As a system, I want all protected pages to verify authentication before rendering, so that unauthenticated users cannot access the dashboard.

#### Acceptance Criteria

1. WHEN a user navigates to any route under the dashboard route group without a JWT in `localStorage`, THE Route_Guard SHALL redirect the user to `/login`.
2. WHEN a user submits the logout action, THE Auth_Store SHALL remove the JWT from `localStorage` and THE Route_Guard SHALL redirect the user to `/login`.
3. THE Auth_Store SHALL decode the JWT payload on page load to extract `userId`, `companyId`, and `role` for use by downstream UI components.
4. IF the JWT stored in `localStorage` is expired or malformed, THEN THE Route_Guard SHALL treat it as absent, clear it from `localStorage`, and redirect the user to `/login`.
5. THE Sidebar SHALL display the authenticated user's name and role.

---

### Requirement 4: Dashboard Layout and Navigation

**User Story:** As an authenticated user, I want a consistent navigation sidebar and layout, so that I can easily move between different sections of the dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL render a persistent Sidebar containing navigation links to: Home, Categories, Products, SKUs, Purchases, Sales, Stock Ledger, Users (OWNER only), and Company Profile (OWNER only).
2. WHILE a user is navigating the dashboard, THE Sidebar SHALL visually highlight the currently active navigation link.
3. THE Dashboard SHALL be responsive and functional on screen widths of 768px and above (tablet and desktop).
4. WHERE the authenticated user's role is STAFF or MANAGER, THE Sidebar SHALL not render navigation links to Users or Company Profile.
5. THE Dashboard SHALL render a top header bar displaying the company name and a logout button.
6. THE Dashboard SHALL use a card-based layout for content areas and a consistent typographic scale.

---

### Requirement 5: Dashboard Home — Summary Stats

**User Story:** As an authenticated user, I want to see key stock metrics on the home page, so that I can quickly understand the current state of the business.

#### Acceptance Criteria

1. WHEN a user navigates to the dashboard home page, THE Dashboard SHALL fetch and display the total count of active products from `/api/products`.
2. WHEN a user navigates to the dashboard home page, THE Dashboard SHALL fetch and display the total count of active SKUs from `/api/product-items`.
3. WHEN a user navigates to the dashboard home page, THE Dashboard SHALL fetch and display the total count of purchase orders from `/api/purchases`.
4. WHEN a user navigates to the dashboard home page, THE Dashboard SHALL fetch and display the total count of sale orders from `/api/sales`.
5. WHILE the dashboard home stats are loading, THE Dashboard SHALL render skeleton loading placeholders for each stat card.
6. IF any stats fetch fails, THEN THE Dashboard SHALL display an inline error message within the affected stat card rather than a full-page error.

---

### Requirement 6: Categories Management

**User Story:** As a manager or owner, I want to manage product categories, so that I can organize products into a logical hierarchy.

#### Acceptance Criteria

1. WHEN a user navigates to the Categories page, THE Dashboard SHALL fetch and display a paginated table of categories from `/api/categories`, showing name, parent category, and status.
2. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Create Category" button that opens a form to POST to `/api/categories`.
3. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render an "Edit" action per table row that opens a form pre-populated with the category's current data and submits a PATCH to `/api/categories/[id]`.
4. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Delete" action per table row that shows a Confirmation_Dialog before submitting a DELETE to `/api/categories/[id]`.
5. WHEN a category create, update, or delete operation succeeds, THE Dashboard SHALL display a success Toast and refresh the categories list.
6. IF a category operation fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.
7. THE Dashboard SHALL render Status_Badges for category active/inactive status.
8. THE Dashboard SHALL render Pagination_Controls for the categories table.

---

### Requirement 7: Products Management

**User Story:** As a manager or owner, I want to manage products, so that I can maintain the product catalog.

#### Acceptance Criteria

1. WHEN a user navigates to the Products page, THE Dashboard SHALL fetch and display a paginated table of products from `/api/products`, showing name, category, HSN code, and status.
2. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Create Product" button that opens a form to POST to `/api/products`.
3. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render an "Edit" action per row that opens a pre-populated form and submits a PATCH to `/api/products/[id]`.
4. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Delete" action per row that shows a Confirmation_Dialog before submitting a DELETE to `/api/products/[id]`.
5. THE Dashboard SHALL render a link per product row that navigates to the Product Options management page for that product.
6. WHEN a product create, update, or delete operation succeeds, THE Dashboard SHALL display a success Toast and refresh the products list.
7. IF a product operation fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.
8. THE Dashboard SHALL render Pagination_Controls for the products table.

---

### Requirement 8: Product Options and Option Values Management

**User Story:** As a manager or owner, I want to manage variant options and their values for each product, so that I can define SKU-level variations like size and color.

#### Acceptance Criteria

1. WHEN a user navigates to a product's options page, THE Dashboard SHALL fetch and display all options for that product from `/api/products/[id]/options`, showing name, type, and required/variant flags.
2. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Add Option" action that submits a POST to `/api/products/[id]/options`.
3. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render an "Edit" and "Delete" action per option, triggering a PATCH or DELETE to `/api/products/[id]/options/[optionId]` respectively.
4. WHEN a user expands or selects an option, THE Dashboard SHALL fetch and display the option's values from `/api/products/[id]/options/[optionId]/values`.
5. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render "Add Value", "Edit Value", and "Delete Value" actions per option, submitting to the corresponding `/api/products/[id]/options/[optionId]/values` endpoints.
6. WHEN a delete action for an option or value is triggered, THE Dashboard SHALL show a Confirmation_Dialog before proceeding.
7. WHEN any option or value operation succeeds, THE Dashboard SHALL display a success Toast and refresh the relevant list.
8. IF any option or value operation fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.

---

### Requirement 9: SKU / Product Items Management

**User Story:** As a manager or owner, I want to manage SKUs (product items), so that I can track individual sellable variants with their prices and stock levels.

#### Acceptance Criteria

1. WHEN a user navigates to the SKUs page, THE Dashboard SHALL fetch and display a paginated table of product items from `/api/product-items`, showing SKU code, product name, status, selling price, and current stock level.
2. THE Dashboard SHALL support filtering the SKUs table by `productId`, `status`, and a search keyword.
3. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Create SKU" button that opens a form to POST to `/api/product-items`.
4. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render an "Edit" action per row that opens a pre-populated form and submits a PATCH to `/api/product-items/[id]`.
5. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Discontinue" action per row that shows a Confirmation_Dialog before submitting a DELETE to `/api/product-items/[id]`.
6. THE Dashboard SHALL render a "View Ledger" link per SKU row that navigates to the Stock Ledger page filtered to that SKU.
7. WHEN a SKU create, update, or discontinue operation succeeds, THE Dashboard SHALL display a success Toast and refresh the SKU list.
8. IF a SKU operation fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.
9. THE Dashboard SHALL render Status_Badges for SKU status (ACTIVE / INACTIVE / DISCONTINUED).
10. THE Dashboard SHALL render Pagination_Controls for the SKUs table.

---

### Requirement 10: Purchases Management (Stock In)

**User Story:** As a manager or owner, I want to manage purchase orders, so that I can record incoming stock and have it reflected in inventory levels.

#### Acceptance Criteria

1. WHEN a user navigates to the Purchases page, THE Dashboard SHALL fetch and display a paginated table of purchases from `/api/purchases`, showing reference number, date, total amount, and status.
2. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Create Purchase" button that opens a multi-step or single form to POST to `/api/purchases`, including at least one line item.
3. WHEN a user selects a purchase row, THE Dashboard SHALL navigate to a purchase detail view fetched from `/api/purchases/[id]`, showing all line items.
4. WHERE the authenticated user's role is MANAGER or OWNER and the purchase status is PENDING, THE Dashboard SHALL render a "Mark as Received" action that submits a PATCH to `/api/purchases/[id]` with `status: "RECEIVED"`.
5. WHERE the authenticated user's role is MANAGER or OWNER and the purchase status is PENDING, THE Dashboard SHALL render a "Cancel" action that shows a Confirmation_Dialog and submits a PATCH with `status: "CANCELLED"`.
6. WHERE the authenticated user's role is MANAGER or OWNER and the purchase status is PENDING, THE Dashboard SHALL render a "Delete" action that shows a Confirmation_Dialog and submits a DELETE to `/api/purchases/[id]`.
7. WHEN a purchase status update succeeds, THE Dashboard SHALL display a success Toast and refresh the purchase detail and list views.
8. IF a purchase operation fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.
9. THE Dashboard SHALL render Status_Badges for purchase status (PENDING / RECEIVED / CANCELLED).
10. THE Dashboard SHALL render Pagination_Controls for the purchases table.

---

### Requirement 11: Sales Management (Stock Out)

**User Story:** As a manager or owner, I want to manage sale orders, so that I can record outgoing stock and have it deducted from inventory levels.

#### Acceptance Criteria

1. WHEN a user navigates to the Sales page, THE Dashboard SHALL fetch and display a paginated table of sales from `/api/sales`, showing reference number, customer name, date, total amount, and status.
2. WHERE the authenticated user's role is MANAGER or OWNER, THE Dashboard SHALL render a "Create Sale" button that opens a form to POST to `/api/sales`, including customer details and at least one line item.
3. WHEN a user selects a sale row, THE Dashboard SHALL navigate to a sale detail view fetched from `/api/sales/[id]`, showing all line items.
4. WHERE the authenticated user's role is MANAGER or OWNER and the sale status is PENDING, THE Dashboard SHALL render a "Mark as Completed" action that submits a PATCH to `/api/sales/[id]` with `status: "COMPLETED"`.
5. WHERE the authenticated user's role is MANAGER or OWNER and the sale status is PENDING, THE Dashboard SHALL render a "Cancel" action that shows a Confirmation_Dialog and submits a PATCH with `status: "CANCELLED"`.
6. WHERE the authenticated user's role is MANAGER or OWNER and the sale status is PENDING, THE Dashboard SHALL render a "Delete" action that shows a Confirmation_Dialog and submits a DELETE to `/api/sales/[id]`.
7. IF the API returns a 422 response when completing a sale, THEN THE Dashboard SHALL display a descriptive error Toast explaining which SKU has insufficient stock.
8. WHEN a sale status update succeeds, THE Dashboard SHALL display a success Toast and refresh the sale detail and list views.
9. THE Dashboard SHALL render Status_Badges for sale status (PENDING / COMPLETED / CANCELLED).
10. THE Dashboard SHALL render Pagination_Controls for the sales table.

---

### Requirement 12: Stock Ledger Viewer

**User Story:** As an authenticated user, I want to view the stock movement history for a SKU, so that I can audit every inventory change.

#### Acceptance Criteria

1. WHEN a user navigates to the Stock Ledger page with a `productItemId` query parameter, THE Dashboard SHALL fetch and display a paginated table of ledger entries from `/api/stock-ledger?productItemId=[id]`.
2. THE Dashboard SHALL display each ledger entry showing movement type, quantity change, quantity after, reference type, and timestamp.
3. THE Dashboard SHALL render Status_Badges or color-coded indicators differentiating PURCHASE (green/positive), SALE (red/negative), and ADJUSTMENT movement types.
4. IF the `productItemId` query parameter is absent, THEN THE Dashboard SHALL render a SKU search or selection input to allow the user to choose a SKU before displaying ledger data.
5. THE Dashboard SHALL render Pagination_Controls for the ledger table.
6. WHILE ledger data is loading, THE Dashboard SHALL display a loading indicator.

---

### Requirement 13: Users Management

**User Story:** As an owner, I want to manage users within my company, so that I can control who has access to the system and with what role.

#### Acceptance Criteria

1. WHEN a user with OWNER role navigates to the Users page, THE Dashboard SHALL fetch and display a paginated table of users from `/api/users`, showing name, email, role, active status, and last login.
2. WHERE the authenticated user's role is OWNER, THE Dashboard SHALL render a "Create User" button that opens a form to POST to `/api/users` with name, email, password, and role fields.
3. WHERE the authenticated user's role is OWNER, THE Dashboard SHALL render an "Edit" action per user row that opens a form to PATCH `/api/users/[id]` for name or role updates.
4. WHERE the authenticated user's role is OWNER, THE Dashboard SHALL render a "Deactivate" action per user row (for users other than the current user) that shows a Confirmation_Dialog before submitting a DELETE to `/api/users/[id]`.
5. WHEN any user operation succeeds, THE Dashboard SHALL display a success Toast and refresh the users list.
6. IF any user operation fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.
7. THE Dashboard SHALL render Status_Badges for user active/inactive status.
8. THE Dashboard SHALL render Pagination_Controls for the users table.
9. WHERE the authenticated user's role is not OWNER, THE Route_Guard SHALL redirect any attempt to access the Users page to the dashboard home.

---

### Requirement 14: Company Profile

**User Story:** As an owner, I want to view and edit my company profile, so that I can keep the company's contact details up to date.

#### Acceptance Criteria

1. WHEN a user with OWNER role navigates to the Company Profile page, THE Dashboard SHALL fetch and display company details from `/api/companies/[companyId]`, showing name, slug, email, phone, logo URL, and subscription plan.
2. WHERE the authenticated user's role is OWNER, THE Dashboard SHALL render an "Edit" form that submits a PATCH to `/api/companies/[companyId]` for name, email, phone, and logo fields.
3. THE Dashboard SHALL display the `slug` and `subscriptionPlan` fields as read-only, as the API does not allow updating them.
4. WHEN the company update succeeds, THE Dashboard SHALL display a success Toast and refresh the displayed profile.
5. IF the company update fails, THEN THE Dashboard SHALL display an error Toast containing the API error message.
6. WHERE the authenticated user's role is not OWNER, THE Route_Guard SHALL redirect any attempt to access the Company Profile page to the dashboard home.

---

### Requirement 15: API Client and Error Handling

**User Story:** As a developer, I want a centralized API client module, so that all HTTP requests consistently attach the JWT token and handle errors uniformly.

#### Acceptance Criteria

1. THE API_Client SHALL attach a `Bearer <token>` `Authorization` header to every request made to `/api/**` endpoints when a JWT is present in `localStorage`.
2. WHEN an API response has a `401` status code, THE API_Client SHALL clear the JWT from `localStorage` and redirect the user to `/login`.
3. THE API_Client SHALL return a structured error object containing the `message` field from the API response body for all non-2xx responses.
4. THE API_Client SHALL be a reusable module importable by all page and component files.

---

### Requirement 16: Loading and Empty States

**User Story:** As a user, I want clear visual feedback during data loading and when no data exists, so that I always understand what is happening on screen.

#### Acceptance Criteria

1. WHILE any list, detail, or stats fetch is in progress, THE Dashboard SHALL render a loading indicator or skeleton UI in the content area.
2. WHEN a data fetch completes with an empty result set, THE Dashboard SHALL display a descriptive empty-state message in the table or list area (e.g., "No categories found. Create your first category.").
3. IF a data fetch returns an error, THEN THE Dashboard SHALL display an inline error message with a retry option in the content area.

---

### Requirement 17: Confirmation Dialogs for Destructive Actions

**User Story:** As a user, I want to be asked to confirm before any delete or destructive action is executed, so that I do not accidentally lose data.

#### Acceptance Criteria

1. WHEN a user triggers a delete, deactivate, discontinue, or cancel action, THE Dashboard SHALL display a Confirmation_Dialog describing the action and requiring explicit confirmation before submitting the API request.
2. WHEN the user dismisses the Confirmation_Dialog without confirming, THE Dashboard SHALL take no action and return the UI to its previous state.
3. THE Confirmation_Dialog SHALL display the name or identifier of the record being acted upon to help the user verify the correct item.

---

### Requirement 18: Role-Based UI Visibility

**User Story:** As a system, I want write actions to be hidden from STAFF-role users, so that read-only users cannot accidentally trigger mutations.

#### Acceptance Criteria

1. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render create, edit, delete, or status-change action buttons across all management pages.
2. WHERE the authenticated user's role is STAFF, THE Role_Guard SHALL not render navigation links to Users or Company Profile in the Sidebar.
3. THE Role_Guard SHALL derive the user's role from the decoded JWT payload stored in `Auth_Store` — role enforcement is UI-level only, not a substitute for server-side RBAC.
