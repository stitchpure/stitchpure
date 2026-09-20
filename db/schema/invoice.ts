import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

import { companies } from "./company";
import { sales } from "./sale";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "ACTIVE",
  "CANCELLED",
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),

  saleId: uuid("sale_id")
    .references(() => sales.id, { onDelete: "restrict" })
    .notNull()
    .unique(),

  invoiceNumber: varchar("invoice_number", { length: 30 }).notNull(),

  financialYear: varchar("financial_year", { length: 5 }).notNull(),

  sequenceNumber: integer("sequence_number").notNull(),

  status: invoiceStatusEnum("status").default("ACTIVE").notNull(),

  generatedAt: timestamp("generated_at").defaultNow().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
