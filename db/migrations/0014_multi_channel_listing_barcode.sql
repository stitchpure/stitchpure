-- Migration: Multi-Channel Listing & Barcode Management
-- Requirements: 1.1, 3.1, 11.4, 16.3

-- ============================================================
-- 1. Create the "channel" enum type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel') THEN
    CREATE TYPE "channel" AS ENUM ('Meesho', 'Flipkart', 'Amazon', 'Shopify', 'Website', 'Offline', 'Other');
  END IF;
END
$$;

-- ============================================================
-- 2. Create the "listings" table
-- ============================================================
CREATE TABLE IF NOT EXISTS "listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "product_item_id" uuid NOT NULL REFERENCES "product_items"("id") ON DELETE CASCADE,
  "channel" "channel" NOT NULL,
  "title" varchar(300) NOT NULL,
  "listing_price" numeric(12, 2) NOT NULL,
  "platform_sku" varchar(150),
  "listing_url" varchar(500),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ============================================================
-- 3. Add new columns to "sales" table
-- ============================================================
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "channel" varchar(50);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "listing_id" uuid REFERENCES "listings"("id") ON DELETE SET NULL;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "return_status" varchar(20);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "return_reason" varchar(50);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "return_condition" varchar(50);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "returned_at" timestamp;

-- ============================================================
-- 4. Extend "movement_type" enum to include RETURN
-- ============================================================
ALTER TYPE "movement_type" ADD VALUE IF NOT EXISTS 'RETURN';
