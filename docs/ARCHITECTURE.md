# Architecture map (Phase 2)

Logical areas of the app — folders are not physically split yet; use this map when adding code.

## Core (inventory / commerce)

| Area | Where |
|---|---|
| Auth | `app/api/auth`, `app/(auth)`, `lib/jwt.ts`, `lib/password.ts` |
| Companies / users | `app/api/companies`, `app/api/users`, dashboard pages |
| Catalog | categories, products, options, product-items |
| Stock | purchases, sales, stock-ledger, stock-count |
| Invoices | invoices, invoice-templates, `services/invoice-*.ts` |

Shared API helpers: `lib/api-route.ts` (`handleApiError`, `jsonOk`, `jsonCreated`).

## Storefront (public + manager)

| Area | Where |
|---|---|
| Public UI | `app/(storefront)/` |
| Manager / inquiries | `storefront-manager`, `storefront-inquiries` |
| APIs / services | `app/api/storefront/*`, `services/storefront.service.ts` |

## Tools (optional / channel helpers)

| Tool | Route |
|---|---|
| Label splitter | `/label-splitter` |
| Flipkart cropper | `/flipkart-cropper` |
| Meesho calculator | `/meesho-calculator` |
| Meesho images | `/meesho-images` |
| Barcode labels | `/barcode-labels` |

Gating today: `companies.hasLabelSplitter` via `GET /api/features` (label splitter / flipkart cropper). Broader feature flags = Phase 3 if requested.

## Dashboard list pages

Prefer `hooks/usePaginatedResource.ts` for paginated `apiClient.get` list fetches (see Categories / Users).
