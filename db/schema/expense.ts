import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  boolean,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { productionBatches } from "./production-batch";
import { productItems } from "./product-item";
import { users } from "./user";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "MATERIAL",
  "LABOUR",
  "PACKAGING",
  "OVERHEAD",
  "TRANSPORT",
  "OTHER",
]);

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),

  category: expenseCategoryEnum("category").notNull(),

  name: varchar("name", { length: 255 }).notNull(),

  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),

  expenseDate: timestamp("expense_date").notNull(),

  productionBatchId: uuid("production_batch_id").references(
    () => productionBatches.id,
    { onDelete: "set null" }
  ),

  productItemId: uuid("product_item_id").references(
    () => productItems.id,
    { onDelete: "set null" }
  ),

  includeInManufacturingCost: boolean("include_in_manufacturing_cost")
    .default(true)
    .notNull(),

  notes: text("notes"),

  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "set null" })
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
