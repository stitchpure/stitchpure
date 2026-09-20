import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { products } from "./product";

export const storefrontInquiries = pgTable("storefront_inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),

  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),

  name: varchar("name", { length: 120 }).notNull(),

  phone: varchar("phone", { length: 20 }).notNull(),

  email: varchar("email", { length: 150 }),

  message: text("message").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
