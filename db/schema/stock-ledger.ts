import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { productItems } from "./product-item";

export const movementTypeEnum = pgEnum("movement_type", [
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
  "RETURN",
]);

export const stockLedger = pgTable(
  "stock_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    companyId: uuid("company_id")
      .references(() => companies.id, {
        onDelete: "cascade",
      })
      .notNull(),

    productItemId: uuid("product_item_id")
      .references(() => productItems.id, {
        onDelete: "cascade",
      })
      .notNull(),

    movementType: movementTypeEnum("movement_type").notNull(),

    referenceType: varchar("reference_type", { length: 50 }),

    referenceId: uuid("reference_id"),

    quantityChange: integer("quantity_change").notNull(),

    quantityAfter: integer("quantity_after").notNull(),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Stock level is aggregated by (productItemId, companyId) on every sale and
    // product view — this composite index turns those SUM scans into seeks.
    itemCompanyIdx: index("stock_ledger_item_company_idx").on(
      table.productItemId,
      table.companyId
    ),
    companyIdx: index("stock_ledger_company_id_idx").on(table.companyId),
  })
);
