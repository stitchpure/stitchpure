CREATE TYPE "public"."expense_category" AS ENUM('MATERIAL', 'LABOUR', 'PACKAGING', 'OVERHEAD', 'TRANSPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."production_batch_status" AS ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."cost_sheet_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"batch_number" varchar(50) NOT NULL,
	"product_id" uuid NOT NULL,
	"product_item_id" uuid,
	"start_date" timestamp NOT NULL,
	"completion_date" timestamp,
	"status" "production_batch_status" DEFAULT 'DRAFT' NOT NULL,
	"planned_quantity" integer NOT NULL,
	"produced_quantity" integer DEFAULT 0 NOT NULL,
	"good_quantity" integer DEFAULT 0 NOT NULL,
	"rejected_quantity" integer DEFAULT 0 NOT NULL,
	"material_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"labour_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"packaging_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"overhead_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"transport_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_manufacturing_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cost_per_unit" numeric(14, 4),
	"material_cost_per_unit" numeric(14, 4),
	"labour_cost_per_unit" numeric(14, 4),
	"packaging_cost_per_unit" numeric(14, 4),
	"overhead_cost_per_unit" numeric(14, 4),
	"transport_cost_per_unit" numeric(14, 4),
	"other_cost_per_unit" numeric(14, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_batches_company_id_batch_number_unique" UNIQUE("company_id","batch_number")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"expense_date" timestamp NOT NULL,
	"production_batch_id" uuid,
	"product_item_id" uuid,
	"include_in_manufacturing_cost" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_cost_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"product_item_id" uuid,
	"production_batch_id" uuid NOT NULL,
	"effective_date" timestamp NOT NULL,
	"material_cost_per_unit" numeric(14, 4) NOT NULL,
	"labour_cost_per_unit" numeric(14, 4) NOT NULL,
	"packaging_cost_per_unit" numeric(14, 4) NOT NULL,
	"overhead_cost_per_unit" numeric(14, 4) NOT NULL,
	"transport_cost_per_unit" numeric(14, 4) NOT NULL,
	"other_cost_per_unit" numeric(14, 4) NOT NULL,
	"total_manufacturing_cost_per_unit" numeric(14, 4) NOT NULL,
	"status" "cost_sheet_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_production_batch_id_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."production_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_sheets" ADD CONSTRAINT "product_cost_sheets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_sheets" ADD CONSTRAINT "product_cost_sheets_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_sheets" ADD CONSTRAINT "product_cost_sheets_production_batch_id_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."production_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_cost_sheets_active_unique" ON "product_cost_sheets" ("product_id", "product_item_id") WHERE status = 'ACTIVE';
