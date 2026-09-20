import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 150 }).notNull(),

  slug: varchar("slug", { length: 150 }).notNull().unique(),

  email: varchar("email", { length: 150 }).notNull(),

  phone: varchar("phone", { length: 20 }),

  logo: varchar("logo", { length: 500 }),

  registeredAddress: text("registered_address"),

  gstin: varchar("gstin", { length: 15 }),

  subscriptionPlan: varchar("subscription_plan", {
    length: 30,
  })
    .default("FREE")
    .notNull(),

  hasLabelSplitter: boolean("has_label_splitter").default(false).notNull(),

  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
