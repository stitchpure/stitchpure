import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { companies } from "./company";

export const invoiceTemplates = pgTable("invoice_templates", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  headerColor: varchar("header_color", { length: 7 }).default("#FFFFFF").notNull(),

  accentColor: varchar("accent_color", { length: 7 }).default("#1a237e").notNull(),

  font: varchar("font", { length: 20 }).default("Roboto").notNull(),

  termsAndConditions: text("terms_and_conditions").default("").notNull(),

  bankDetails: text("bank_details").default("").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
