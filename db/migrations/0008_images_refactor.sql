-- Categories: replace images[] array with single banner_image text column
ALTER TABLE "categories" DROP COLUMN IF EXISTS "images";
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_image" text;

-- Products: add images[] array column
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" text[] DEFAULT '{}' NOT NULL;
