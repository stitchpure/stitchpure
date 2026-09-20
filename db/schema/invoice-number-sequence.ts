import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { companies } from "./company";

export const invoiceNumberSequences = pgTable(
  "invoice_number_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),

    financialYear: varchar("financial_year", { length: 5 }).notNull(),

    lastSequence: integer("last_sequence").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCompanyFy: unique().on(table.companyId, table.financialYear),
  })
);
