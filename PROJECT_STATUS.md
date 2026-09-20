# Stock Management — Project Status

> Last refreshed: Phase 1 (bundle hygiene) — Aug 2026

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| Tests | Vitest |

---

## Architecture

```
API Route → authMiddleware → requireRole → Service → Drizzle ORM → PostgreSQL
```

Public storefront routes live under `app/(storefront)/` and do not require JWT.

---

## What’s built

### Core inventory & commerce (dashboard)
- Auth (register / login / me), companies, users, RBAC (OWNER / MANAGER / STAFF / SUPER_ADMIN)
- Categories, products, options, SKUs (`product_items`)
- Purchases, sales, stock ledger, stock count
- Expenses, cost sheets, production batches
- GST invoices (PDF via pdf-lib, QR via qrcode)
- Multi-channel listings / barcode labels
- Packing verification & return processing (camera barcode scanner)
- Tools: label splitter, Meesho calculator/images, Flipkart cropper, image generator

### Storefront (public + manager)
- Company directory: `/storefront`
- Company page: `/storefront/c/[companySlug]`
- Product detail: `/storefront/p/[productId]`
- All-products browse: `/storefront/products`
- Manager: `/storefront-manager`, inquiries: `/storefront-inquiries`
- APIs: `/api/storefront/companies`, `products`, `listings`, `inquiries`
- Tables: `storefront_listings`, `storefront_inquiries`

### Frontend
- Dashboard UI under `app/(dashboard)/` — **in use**
- Shared UI in `components/` (toasts, modals, pagination, scanner, storefront cards, etc.)

---

## Database (high level)

Core: `companies`, `users`, `categories`, `products`, options/values, `product_items`, `suppliers`, `purchases`/`purchase_items`, `sales`/`sale_items`, `stock_ledger`

Later migrations also cover: images, GST invoice fields, listings/barcodes, performance indexes, **storefront listings & inquiries**.

Run: `npm run db:migrate` after pulling new migrations.

---

## Env setup

Copy `.env.example` → `.env.local` and fill values. Required: `DATABASE_URL`, `JWT_SECRET`. Optional: Cloudinary, rate-limit overrides, CORS.

---

## Phase 1 notes (bundle hygiene)

Heavy libraries load on demand where practical:
- `pdfjs-dist` / `pdf-lib` / `jszip` — PDF splitter & related flows
- `qrcode` — invoice QR
- `html5-qrcode` — barcode scanner (also `next/dynamic` on sales / stock-count / packing / returns)
- `jsbarcode` stays statically imported in `lib/barcode.ts` (sync API; page already code-split)

No features removed.

## Phase 2 notes (architecture light)

- Shared API errors: `lib/api-route.ts` (`handleApiError`, `jsonOk`, `jsonCreated`) — used by core inventory/invoice/expense/user routes
- Shared list fetch: `hooks/usePaginatedResource.ts` — wired on Categories + Users (pattern for other list pages)
- Folder map (no move): `docs/ARCHITECTURE.md` — core vs storefront vs tools

Phase 3 (feature-flag / hide tools) stays on hold until requested.

---

## Known gaps / follow-ups

| Area | Notes |
|---|---|
| DB seed | No full seed script yet |
| Property-based tests | Optional / skipped |
| `PROJECT_STATUS` endpoint inventory | Older sections below may lag; prefer code + this summary |
| Cloudinary | Required for image upload features |

---

## API / services (legacy inventory)

The sections below remain a useful map of the **original** inventory APIs. Storefront, invoices, expenses, and tool routes are additional and live under `app/api/` — check that tree for the full list.

### Auth (public)
| Method | Endpoint |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| GET | `/api/me` |

### Inventory domains
Categories, products, options, product-items, companies, users, purchases, sales, stock-ledger — CRUD-style routes under `/api/<domain>` with role guards as documented in middleware/services.

### Infrastructure
| File | Purpose |
|---|---|
| `middleware.ts` | CORS + rate limiting |
| `middleware/auth.ts` | JWT verification |
| `middleware/role.ts` | `requireRole` |
| `lib/pagination.ts` | Pagination helpers |
| `lib/jwt.ts` / `lib/password.ts` | Auth helpers |

### RBAC
| Role | Can do |
|---|---|
| SUPER_ADMIN | Everything (bypass company scope) |
| OWNER | Company settings + users + full write |
| MANAGER | Products, stock, sales/purchases writes |
| STAFF | Read-oriented access |
