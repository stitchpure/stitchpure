CREATE TYPE "public"."channel" AS ENUM('Meesho', 'Flipkart', 'Amazon', 'Shopify', 'Website', 'Offline', 'Other');--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'RETURN';--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_item_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"title" varchar(300) NOT NULL,
	"listing_price" numeric(12, 2) NOT NULL,
	"platform_sku" varchar(150),
	"listing_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storefront_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"wholesale_price" numeric(12, 2) NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_listings_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "channel" varchar(50);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "listing_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "return_status" varchar(20);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "return_reason" varchar(50);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "return_condition" varchar(50);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "returned_at" timestamp;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_listings" ADD CONSTRAINT "storefront_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;