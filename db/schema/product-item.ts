import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  unique,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

import { products } from "./product";

export const productItemStatusEnum = pgEnum("product_item_status", [
  "ACTIVE",
  "INACTIVE",
  "DISCONTINUED",
]);

export const productItems = pgTable(
  "product_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
      })
      .notNull(),

    sku: varchar("sku", {
      length: 100,
    }).notNull(),

    barcode: varchar("barcode", {
      length: 100,
    }),

    purchasePrice: numeric("purchase_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    sellingPrice: numeric("selling_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    mrp: numeric("mrp", {
      precision: 12,
      scale: 2,
    }),
    weight: numeric("weight", {
      precision: 10,
      scale: 2,
    }),
    status: productItemStatusEnum("status").default("ACTIVE").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSku: unique().on(table.sku),
    uniqueBarcode: unique().on(table.barcode),
    productIdx: index("product_items_product_id_idx").on(table.productId),
  })
);
