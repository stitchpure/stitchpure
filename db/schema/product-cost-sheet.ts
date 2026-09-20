import {
  pgTable,
  pgEnum,
  uuid,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

import { products } from "./product";
import { productItems } from "./product-item";
import { productionBatches } from "./production-batch";

export const costSheetStatusEnum = pgEnum("cost_sheet_status", [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const productCostSheets = pgTable("product_cost_sheets", {
  id: uuid("id").defaultRandom().primaryKey(),

  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "restrict" })
    .notNull(),

  productItemId: uuid("product_item_id").references(
    () => productItems.id,
    { onDelete: "set null" }
  ),

  productionBatchId: uuid("production_batch_id")
    .references(() => productionBatches.id, { onDelete: "restrict" })
    .notNull(),

  effectiveDate: timestamp("effective_date").notNull(),

  materialCostPerUnit: numeric("material_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  labourCostPerUnit: numeric("labour_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  packagingCostPerUnit: numeric("packaging_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  overheadCostPerUnit: numeric("overhead_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  transportCostPerUnit: numeric("transport_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  otherCostPerUnit: numeric("other_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  totalManufacturingCostPerUnit: numeric("total_manufacturing_cost_per_unit", {
    precision: 14,
    scale: 4,
  }).notNull(),

  status: costSheetStatusEnum("status").default("DRAFT").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
