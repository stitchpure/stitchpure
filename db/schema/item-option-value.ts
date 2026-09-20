import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { productItems } from "./product-item";
import { productOptions } from "./product-option";
import { productOptionValues } from "./product-option-value";

export const itemOptionValues = pgTable(
  "item_option_values",
  {
    itemId: uuid("item_id")
      .references(() => productItems.id, {
        onDelete: "cascade",
      })
      .notNull(),

    optionId: uuid("option_id")
      .references(() => productOptions.id, {
        onDelete: "cascade",
      })
      .notNull(),

    optionValueId: uuid("option_value_id")
      .references(() => productOptionValues.id, {
        onDelete: "restrict",
      })
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    itemOptionValuePrimaryKey: primaryKey({
      columns: [table.itemId, table.optionValueId],
    }),

    uniqueItemOption: unique().on(table.itemId, table.optionId),
  })
);
