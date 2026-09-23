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

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Company wise data isolation
    companyId: uuid("company_id")
      .references(() => companies.id, {
        onDelete: "cascade",
      })
      .notNull(),

    // Parent category
    // null = main category
    // value = sub category
    parentId: uuid("parent_id"),

    name: varchar("name", {
      length: 100,
    }).notNull(),

    slug: varchar("slug", {
      length: 100,
    }).notNull(),

    description: text("description"),

    // Single banner/icon image URL for the category (used in storefronts)
    bannerImage: text("banner_image"),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("categories_company_id_idx").on(table.companyId),
  })
);
