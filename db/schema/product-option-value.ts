import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { productOptions } from "./product-option";

export const productOptionValues = pgTable(
  "product_option_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    optionId: uuid("option_id")
      .references(() => productOptions.id, {
        onDelete: "cascade",
      })
      .notNull(),

    value: varchar("value", {
      length: 100,
    }).notNull(),

    code: varchar("code", {
      length: 50,
    }),

    colorCode: varchar("color_code", {
      length: 20,
    }),

    displayOrder: integer("display_order").default(0).notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOptionValue: unique().on(table.optionId, table.value),
  })
);
