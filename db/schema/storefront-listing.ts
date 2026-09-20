import {
  pgTable,
  uuid,
  numeric,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { products } from "./product";

export const storefrontListings = pgTable(
  "storefront_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),

    wholesalePrice: numeric("wholesale_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    isVisible: boolean("is_visible").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueProduct: unique().on(table.productId),
  })
);
