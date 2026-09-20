ALTER TABLE "companies" ADD COLUMN "gstin" varchar(15);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "buyer_gstin" varchar(15);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "shipping_address" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "place_of_supply" varchar(50);