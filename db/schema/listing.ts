import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { productItems } from "./product-item";

export const channelEnum = pgEnum("channel", [
  "Meesho",
  "Flipkart",
  "Amazon",
  "Shopify",
  "Website",
  "Offline",
  "Other",
]);

export const listings = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),

  productItemId: uuid("product_item_id")
    .references(() => productItems.id, { onDelete: "cascade" })
    .notNull(),

  channel: channelEnum("channel").notNull(),

  title: varchar("title", { length: 300 }).notNull(),

  listingPrice: numeric("listing_price", { precision: 12, scale: 2 }).notNull(),

  platformSku: varchar("platform_sku", { length: 150 }),

  listingUrl: varchar("listing_url", { length: 500 }),

  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
