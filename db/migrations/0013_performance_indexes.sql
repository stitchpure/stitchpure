-- Performance indexes for scaling to 1000+ companies
-- These composite indexes speed up the most common query patterns

-- Sales: listing by company + date (most common query)
CREATE INDEX IF NOT EXISTS idx_sales_company_date ON sales (company_id, sale_date DESC);

-- Sales: filtering by status within a company
CREATE INDEX IF NOT EXISTS idx_sales_company_status ON sales (company_id, status);

-- Sale items: lookup by sale (JOIN optimization)
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);

-- Stock ledger: per-item history (most queried table at scale)
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item_created ON stock_ledger (product_item_id, created_at DESC);

-- Stock ledger: company-wide ledger view
CREATE INDEX IF NOT EXISTS idx_stock_ledger_company_created ON stock_ledger (company_id, created_at DESC);

-- Invoices: listing by company + financial year + generated date
CREATE INDEX IF NOT EXISTS idx_invoices_company_fy_date ON invoices (company_id, financial_year, generated_at DESC);

-- Invoices: search by invoice number
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices (invoice_number);

-- Production batches: listing by company + status
CREATE INDEX IF NOT EXISTS idx_production_batches_company_status ON production_batches (company_id, status);

-- Expenses: listing by company + date
CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses (company_id, expense_date DESC);

-- Products: listing by company
CREATE INDEX IF NOT EXISTS idx_products_company ON products (company_id);

-- Product items: lookup by product
CREATE INDEX IF NOT EXISTS idx_product_items_product ON product_items (product_id);
