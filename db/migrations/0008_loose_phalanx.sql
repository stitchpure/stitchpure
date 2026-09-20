ALTER TABLE "categories" ADD COLUMN "banner_image" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "images" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "images";