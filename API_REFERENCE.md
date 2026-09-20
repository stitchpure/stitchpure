# API Reference

Base URL: `http://localhost:3000/api`

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

All responses follow:
```json
{ "success": true, "data": {...} }
{ "success": false, "message": "..." }
```

---

## Auth

### POST /api/auth/register
Register a new company with an owner account.

**Request Body:**
```json
{
  "company": {
    "name": "My Store",
    "slug": "my-store",
    "email": "company@example.com",
    "phone": "9876543210"
  },
  "owner": {
    "name": "John Doe",
    "email": "owner@example.com",
    "password": "password123"
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Company registered successfully",
  "data": {
    "token": "<jwt>",
    "user": { "id": "uuid", "name": "John Doe", "email": "owner@example.com", "role": "OWNER" },
    "company": { "id": "uuid", "name": "My Store", "slug": "my-store" }
  }
}
```

---

### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "owner@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt>",
    "user": { "id": "uuid", "name": "John Doe", "email": "owner@example.com", "role": "OWNER" },
    "company": { "id": "uuid", "name": "My Store", "slug": "my-store" }
  }
}
```

---

### GET /api/me
Get current authenticated user info from token.

**Response 200:**
```json
{
  "success": true,
  "user": { "userId": "uuid", "companyId": "uuid", "role": "OWNER" }
}
```

---

## Categories

### GET /api/categories
List all active categories (paginated).

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `includeInactive=true` (optional — include soft-deleted)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "companyId": "uuid", "parentId": null,
      "name": "Footwear", "slug": "footwear",
      "description": "All footwear", "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z", "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### POST /api/categories
Create a new category. Supports sub-categories via `parentId`.

**Request Body:**
```json
{
  "name": "Men's Slippers",
  "parentId": "uuid",
  "description": "Optional description"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": { "id": "uuid", "name": "Men's Slippers", "slug": "men-s-slippers", ... }
}
```

---

### GET /api/categories/:id
Get a single category by ID.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Footwear", ... }
}
```

---

### PATCH /api/categories/:id
Update a category.

**Request Body (all optional):**
```json
{
  "name": "Updated Name",
  "parentId": "uuid",
  "description": "Updated description"
}
```

**Response 200:**
```json
{ "success": true, "message": "Category updated successfully", "data": { ... } }
```

---

### DELETE /api/categories/:id
Soft-delete a category (sets `isActive = false`).

**Response 200:**
```json
{ "success": true, "message": "Category deleted successfully", "data": { ... } }
```

---

## Products

### GET /api/products
List all active products (paginated).

**Query Params:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "companyId": "uuid", "categoryId": "uuid",
      "name": "Men EVA Slipper", "slug": "men-eva-slipper",
      "description": "Comfortable slipper", "hsnCode": "6402",
      "isActive": true, "createdAt": "...", "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 }
}
```

---

### POST /api/products
Create a product. **Requires MANAGER or OWNER.**

**Request Body:**
```json
{
  "name": "Men EVA Slipper",
  "categoryId": "uuid",
  "description": "Comfortable EVA slipper",
  "hsnCode": "6402"
}
```

**Response 201:**
```json
{ "success": true, "message": "Product created successfully", "data": { ... } }
```

---

### GET /api/products/:id
Get a single product.

**Response 200:**
```json
{ "success": true, "data": { "id": "uuid", "name": "Men EVA Slipper", ... } }
```

---

### PATCH /api/products/:id
Update a product. **Requires MANAGER or OWNER.**

**Request Body (all optional):**
```json
{
  "name": "Updated Name",
  "categoryId": "uuid",
  "description": "Updated",
  "hsnCode": "6402"
}
```

**Response 200:**
```json
{ "success": true, "message": "Product updated successfully", "data": { ... } }
```

---

### DELETE /api/products/:id
Soft-delete a product. **Requires MANAGER or OWNER.**

**Response 200:**
```json
{ "success": true, "message": "Product deleted successfully", "data": { ... } }
```

---

## Product Options

### GET /api/products/:id/options
List all active variant options for a product.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "productId": "uuid",
      "name": "Size", "slug": "size",
      "type": "TEXT", "isRequired": true,
      "isVariant": true, "isActive": true, "displayOrder": 0
    }
  ]
}
```

---

### POST /api/products/:id/options
Create a product option. **Requires MANAGER or OWNER.**

**Request Body:**
```json
{
  "name": "Size",
  "type": "TEXT",
  "isRequired": true,
  "isVariant": true,
  "displayOrder": 0
}
```

**`type` values:** `TEXT` | `COLOR` | `NUMBER`

**Response 201:**
```json
{ "success": true, "data": { "id": "uuid", "name": "Size", "slug": "size", ... } }
```

---

### PATCH /api/products/:id/options/:optionId
Update an option. **Requires MANAGER or OWNER.**

**Request Body (all optional):**
```json
{
  "name": "Colour",
  "type": "COLOR",
  "isRequired": false,
  "displayOrder": 1
}
```

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

### DELETE /api/products/:id/options/:optionId
Soft-delete an option. **Requires MANAGER or OWNER.**

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

## Product Option Values

### GET /api/products/:id/options/:optionId/values
List all active values for an option.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "optionId": "uuid",
      "value": "7", "code": null,
      "colorCode": null, "displayOrder": 0, "isActive": true
    }
  ]
}
```

---

### POST /api/products/:id/options/:optionId/values
Add a value to an option. **Requires MANAGER or OWNER.**

**Request Body:**
```json
{
  "value": "7",
  "code": "SZ7",
  "colorCode": null,
  "displayOrder": 0
}
```

For color options:
```json
{
  "value": "Black",
  "code": "BLK",
  "colorCode": "#000000",
  "displayOrder": 0
}
```

**Response 201:**
```json
{ "success": true, "data": { "id": "uuid", "value": "7", ... } }
```

---

### PATCH /api/products/:id/options/:optionId/values/:valueId
Update an option value. **Requires MANAGER or OWNER.**

**Request Body (all optional):**
```json
{
  "value": "8",
  "code": "SZ8",
  "displayOrder": 1
}
```

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

### DELETE /api/products/:id/options/:optionId/values/:valueId
Soft-delete an option value. **Requires MANAGER or OWNER.**

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

## Product Items (SKUs)

### GET /api/product-items
List SKUs with stock levels (paginated).

**Query Params:**
- `page`, `limit`
- `productId=uuid` — filter by product
- `status=ACTIVE|INACTIVE|DISCONTINUED`
- `search=keyword` — search SKU, barcode, or product name

**Response 200:**
```json
{
  "success": true,
  "message": "Product items fetched successfully",
  "data": [
    {
      "id": "uuid", "productId": "uuid", "productName": "Men EVA Slipper",
      "sku": "MEA-7-BLK", "barcode": "1234567890",
      "purchasePrice": "250.00", "sellingPrice": "399.00", "mrp": "450.00",
      "weight": "0.30", "status": "ACTIVE",
      "stockLevel": 45,
      "optionValues": [
        { "optionId": "uuid", "optionName": "Size", "optionSlug": "size", "optionValueId": "uuid", "value": "7", "code": null, "colorCode": null }
      ],
      "createdAt": "...", "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

---

### POST /api/product-items
Create a SKU. **Requires MANAGER or OWNER.**

**Request Body:**
```json
{
  "productId": "uuid",
  "sku": "MEA-7-BLK",
  "barcode": "1234567890",
  "purchasePrice": 250,
  "sellingPrice": 399,
  "mrp": 450,
  "weight": 0.30,
  "status": "ACTIVE",
  "optionValues": [
    { "optionId": "uuid-size-option", "optionValueId": "uuid-size-7" },
    { "optionId": "uuid-color-option", "optionValueId": "uuid-color-black" }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Product item created successfully",
  "data": { "id": "uuid", "sku": "MEA-7-BLK", ... }
}
```

---

### GET /api/product-items/:id
Get a single SKU with options and stock level.

**Response 200:**
```json
{
  "success": true,
  "message": "Product item fetched successfully",
  "data": {
    "id": "uuid", "sku": "MEA-7-BLK",
    "stockLevel": 45,
    "optionValues": [ ... ],
    ...
  }
}
```

---

### PATCH /api/product-items/:id
Update a SKU. **Requires MANAGER or OWNER.**

**Request Body (all optional):**
```json
{
  "sku": "MEA-7-BLK-V2",
  "barcode": "9876543210",
  "purchasePrice": 260,
  "sellingPrice": 420,
  "mrp": 450,
  "weight": 0.32,
  "status": "ACTIVE"
}
```

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

### DELETE /api/product-items/:id
Mark a SKU as DISCONTINUED. **Requires MANAGER or OWNER.**

**Response 200:**
```json
{ "success": true, "data": { "status": "DISCONTINUED", ... } }
```

---

## Company

### GET /api/companies/:id
Get company profile. Only accessible for your own company.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "name": "My Store", "slug": "my-store",
    "email": "company@example.com", "phone": "9876543210",
    "logo": null, "subscriptionPlan": "FREE", "isActive": true
  }
}
```

---

### PATCH /api/companies/:id
Update company profile. **Requires OWNER.**

**Request Body (all optional):**
```json
{
  "name": "My Updated Store",
  "email": "new@example.com",
  "phone": "9999999999",
  "logo": "https://example.com/logo.png"
}
```

> `slug`, `subscriptionPlan`, and `isActive` cannot be updated via this endpoint.

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

## Users

### GET /api/users
List all users in the company (paginated). **Requires OWNER.**

**Query Params:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "companyId": "uuid",
      "name": "Jane Smith", "email": "jane@example.com",
      "role": "MANAGER", "isActive": true,
      "lastLogin": "2024-01-01T10:00:00Z",
      "createdAt": "...", "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

### POST /api/users
Create a new user under your company. **Requires OWNER.**

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "securepass",
  "role": "MANAGER"
}
```

**`role` values:** `OWNER` | `MANAGER` | `STAFF`

**Response 201:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Jane Smith", "email": "jane@example.com", "role": "MANAGER", ... }
}
```

---

### GET /api/users/:id
Get a single user. **Requires OWNER.**

**Response 200:**
```json
{ "success": true, "data": { "id": "uuid", "name": "Jane Smith", ... } }
```

---

### PATCH /api/users/:id
Update user name or role. **Requires OWNER. Cannot update your own account.**

**Request Body (all optional):**
```json
{
  "name": "Jane Updated",
  "role": "STAFF"
}
```

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

---

### DELETE /api/users/:id
Deactivate a user. **Requires OWNER. Cannot deactivate your own account.**

**Response 200:**
```json
{ "success": true, "data": { "isActive": false, ... } }
```

---

## Purchases (Stock In)

### GET /api/purchases
List all purchase orders (paginated). Ordered by date descending.

**Query Params:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "companyId": "uuid", "supplierId": "uuid",
      "referenceNo": "PO-001", "purchaseDate": "2024-01-15T00:00:00Z",
      "totalAmount": "5000.00", "status": "RECEIVED",
      "notes": null, "createdAt": "...", "updatedAt": "..."
    }
  ],
  "pagination": { ... }
}
```

---

### POST /api/purchases
Create a purchase order. **Requires MANAGER or OWNER.**

If `status` is `RECEIVED`, stock ledger is updated immediately.

**Request Body:**
```json
{
  "supplierId": "uuid",
  "referenceNo": "PO-001",
  "purchaseDate": "2024-01-15",
  "status": "PENDING",
  "notes": "Urgent order",
  "items": [
    { "productItemId": "uuid", "quantity": 50, "unitPrice": 250 },
    { "productItemId": "uuid2", "quantity": 30, "unitPrice": 180 }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "status": "PENDING", "totalAmount": "18100.00",
    "items": [ { "id": "uuid", "productItemId": "uuid", "quantity": 50, "unitPrice": "250.00", "totalPrice": "12500.00" } ]
  }
}
```

---

### GET /api/purchases/:id
Get a purchase with all line items.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "status": "RECEIVED",
    "items": [ { "productItemId": "uuid", "quantity": 50, "unitPrice": "250.00", "totalPrice": "12500.00" } ]
  }
}
```

---

### PATCH /api/purchases/:id
Update purchase status. **Requires MANAGER or OWNER.**

| Transition | Effect |
|---|---|
| `PENDING → RECEIVED` | Writes stock ledger (+quantity per item) |
| `RECEIVED → CANCELLED` | Writes reversal ledger entries (-quantity per item) |
| `RECEIVED → PENDING` | ❌ Not allowed (400) |

**Request Body:**
```json
{
  "status": "RECEIVED",
  "notes": "Goods received and verified"
}
```

**Response 200:**
```json
{ "success": true, "data": { "status": "RECEIVED", ... } }
```

---

### DELETE /api/purchases/:id
Delete a purchase order. **Requires MANAGER or OWNER. Only allowed when status is PENDING.**

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

**Response 409 (if not PENDING):**
```json
{ "success": false, "message": "Can only delete pending purchases" }
```

---

## Sales (Stock Out)

### GET /api/sales
List all sales orders (paginated). Ordered by date descending.

**Query Params:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "companyId": "uuid",
      "referenceNo": "SO-001", "saleDate": "2024-01-20T00:00:00Z",
      "customerName": "Rahul Kumar", "customerPhone": "9876543210",
      "totalAmount": "1197.00", "status": "COMPLETED",
      "notes": null, "createdAt": "...", "updatedAt": "..."
    }
  ],
  "pagination": { ... }
}
```

---

### POST /api/sales
Create a sale order. **Requires MANAGER or OWNER.**

If `status` is `COMPLETED`, stock is validated and ledger is updated immediately. Returns HTTP 422 if any item would go below zero stock.

**Request Body:**
```json
{
  "referenceNo": "SO-001",
  "saleDate": "2024-01-20",
  "customerName": "Rahul Kumar",
  "customerPhone": "9876543210",
  "status": "COMPLETED",
  "notes": null,
  "items": [
    { "productItemId": "uuid", "quantity": 3, "unitPrice": 399 }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "status": "COMPLETED", "totalAmount": "1197.00",
    "items": [ { "productItemId": "uuid", "quantity": 3, "unitPrice": "399.00", "totalPrice": "1197.00" } ]
  }
}
```

**Response 422 (insufficient stock):**
```json
{
  "success": false,
  "message": "Insufficient stock for SKU MEA-7-BLK: available 2, requested 3"
}
```

---

### GET /api/sales/:id
Get a sale with all line items.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "status": "COMPLETED",
    "items": [ { "productItemId": "uuid", "quantity": 3, "unitPrice": "399.00", "totalPrice": "1197.00" } ]
  }
}
```

---

### PATCH /api/sales/:id
Update sale status. **Requires MANAGER or OWNER.**

| Transition | Effect |
|---|---|
| `PENDING → COMPLETED` | Validates stock floor + writes negative ledger |
| `COMPLETED → CANCELLED` | Writes reversal ledger entries (+quantity per item) |
| `COMPLETED → PENDING` | ❌ Not allowed (400) |

**Request Body:**
```json
{
  "status": "CANCELLED",
  "notes": "Customer cancelled order"
}
```

**Response 200:**
```json
{ "success": true, "data": { "status": "CANCELLED", ... } }
```

---

### DELETE /api/sales/:id
Delete a sale. **Requires MANAGER or OWNER. Only allowed when status is PENDING.**

**Response 200:**
```json
{ "success": true, "data": { ... } }
```

**Response 409 (if not PENDING):**
```json
{ "success": false, "message": "Can only delete pending sales" }
```

---

## Stock Ledger

### GET /api/stock-ledger
Get movement history for a SKU (paginated). `productItemId` is required.

**Query Params:**
- `productItemId=uuid` (**required**)
- `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "companyId": "uuid",
      "productItemId": "uuid",
      "movementType": "PURCHASE",
      "referenceType": "purchase",
      "referenceId": "uuid",
      "quantityChange": 50,
      "quantityAfter": 50,
      "notes": null,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "uuid2",
      "movementType": "SALE",
      "quantityChange": -3,
      "quantityAfter": 47,
      "createdAt": "2024-01-20T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

**`movementType` values:** `PURCHASE` | `SALE` | `ADJUSTMENT`

---

## Error Responses

### 400 — Validation Failed
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

### 401 — Unauthorized
```json
{ "success": false, "message": "Authorization header is missing" }
{ "success": false, "message": "Invalid or expired token" }
```

### 403 — Forbidden
```json
{ "success": false, "message": "Forbidden" }
```

### 404 — Not Found
```json
{ "success": false, "message": "Product not found" }
```

### 409 — Conflict
```json
{ "success": false, "message": "An item with this SKU already exists" }
```

### 422 — Unprocessable
```json
{ "success": false, "message": "Insufficient stock for SKU MEA-7-BLK: available 2, requested 3" }
```

---

## RBAC Quick Reference

| Endpoint Group | STAFF | MANAGER | OWNER |
|---|---|---|---|
| All GET endpoints | ✅ | ✅ | ✅ |
| Products / Options / SKUs (write) | ❌ | ✅ | ✅ |
| Purchases / Sales (write) | ❌ | ✅ | ✅ |
| Company PATCH | ❌ | ❌ | ✅ |
| Users (all write) | ❌ | ❌ | ✅ |
