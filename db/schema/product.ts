import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { categories } from "./category";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    companyId: uuid("company_id")
      .references(() => companies.id, {
        onDelete: "cascade",
      })
      .notNull(),

    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    name: varchar("name", {
      length: 150,
    }).notNull(),

    slug: varchar("slug", {
      length: 180,
    }).notNull(),

    description: text("description"),

    hsnCode: varchar("hsn_code", {
      length: 20,
    }),

    // Up to 5 product image URLs (stored on Cloudinary)
    images: text("images").array().default([]).notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("products_company_id_idx").on(table.companyId),
    categoryIdx: index("products_category_id_idx").on(table.categoryId),
  })
);
