import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

import { products } from "./product";

export const optionTypeEnum = pgEnum("option_type", [
  "TEXT",
  "COLOR",
  "NUMBER",
]);

export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
      })
      .notNull(),

    name: varchar("name", {
      length: 100,
    }).notNull(),
    slug: varchar("slug", {
      length: 100,
    }).notNull(),
    type: optionTypeEnum("type").default("TEXT").notNull(),

    isRequired: boolean("is_required").default(true).notNull(),

    isVariant: boolean("is_variant").default(true).notNull(),
    isActive: boolean("is_active").notNull().default(true),

    displayOrder: integer("display_order").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueProductOption: unique().on(table.productId, table.name),
  })
);
