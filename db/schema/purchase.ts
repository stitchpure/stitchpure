import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { suppliers } from "./supplier";
import { productItems } from "./product-item";

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "PENDING",
  "RECEIVED",
  "CANCELLED",
]);

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, {
      onDelete: "cascade",
    })
    .notNull(),

  supplierId: uuid("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
  }),

  referenceNo: varchar("reference_no", { length: 100 }),

  purchaseDate: timestamp("purchase_date").notNull(),

  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),

  status: purchaseStatusEnum("status").default("PENDING").notNull(),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  purchaseId: uuid("purchase_id")
    .references(() => purchases.id, {
      onDelete: "cascade",
    })
    .notNull(),

  productItemId: uuid("product_item_id")
    .references(() => productItems.id, {
      onDelete: "restrict",
    })
    .notNull(),

  quantity: integer("quantity").notNull(),

  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),

  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
