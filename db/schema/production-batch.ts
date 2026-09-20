import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { products } from "./product";
import { productItems } from "./product-item";

export const productionBatchStatusEnum = pgEnum("production_batch_status", [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const productionBatches = pgTable(
  "production_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),

    batchNumber: varchar("batch_number", { length: 50 }).notNull(),

    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "restrict" })
      .notNull(),

    productItemId: uuid("product_item_id").references(
      () => productItems.id,
      { onDelete: "set null" }
    ),

    startDate: timestamp("start_date").notNull(),

    completionDate: timestamp("completion_date"),

    status: productionBatchStatusEnum("status").default("DRAFT").notNull(),

    plannedQuantity: integer("planned_quantity").notNull(),

    producedQuantity: integer("produced_quantity").default(0).notNull(),

    goodQuantity: integer("good_quantity").default(0).notNull(),

    rejectedQuantity: integer("rejected_quantity").default(0).notNull(),

    materialCost: numeric("material_cost", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    labourCost: numeric("labour_cost", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    packagingCost: numeric("packaging_cost", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    overheadCost: numeric("overhead_cost", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    transportCost: numeric("transport_cost", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    otherCost: numeric("other_cost", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    totalManufacturingCost: numeric("total_manufacturing_cost", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),

    costPerUnit: numeric("cost_per_unit", { precision: 14, scale: 4 }),

    materialCostPerUnit: numeric("material_cost_per_unit", {
      precision: 14,
      scale: 4,
    }),

    labourCostPerUnit: numeric("labour_cost_per_unit", {
      precision: 14,
      scale: 4,
    }),

    packagingCostPerUnit: numeric("packaging_cost_per_unit", {
      precision: 14,
      scale: 4,
    }),

    overheadCostPerUnit: numeric("overhead_cost_per_unit", {
      precision: 14,
      scale: 4,
    }),

    transportCostPerUnit: numeric("transport_cost_per_unit", {
      precision: 14,
      scale: 4,
    }),

    otherCostPerUnit: numeric("other_cost_per_unit", {
      precision: 14,
      scale: 4,
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueBatchNumber: unique().on(table.companyId, table.batchNumber),
  })
);
