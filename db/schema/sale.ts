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
import { listings } from "./listing";
import { productItems } from "./product-item";

export const saleStatusEnum = pgEnum("sale_status", [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
]);

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, {
      onDelete: "cascade",
    })
    .notNull(),

  referenceNo: varchar("reference_no", { length: 100 }),

  saleDate: timestamp("sale_date").notNull(),

  customerName: varchar("customer_name", { length: 150 }),

  customerPhone: varchar("customer_phone", { length: 20 }),

  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),

  status: saleStatusEnum("status").default("PENDING").notNull(),

  notes: text("notes"),

  buyerAddress: text("buyer_address"),

  buyerGstin: varchar("buyer_gstin", { length: 15 }),

  shippingAddress: text("shipping_address"),

  placeOfSupply: varchar("place_of_supply", { length: 50 }),

  channel: varchar("channel", { length: 50 }),

  listingId: uuid("listing_id").references(() => listings.id, {
    onDelete: "set null",
  }),

  returnStatus: varchar("return_status", { length: 20 }),

  returnReason: varchar("return_reason", { length: 50 }),

  returnCondition: varchar("return_condition", { length: 50 }),

  returnedAt: timestamp("returned_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  saleId: uuid("sale_id")
    .references(() => sales.id, {
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
