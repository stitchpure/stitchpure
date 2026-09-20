import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

import { companies } from "./company";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id, {
      onDelete: "cascade",
    })
    .notNull(),

  name: varchar("name", {
    length: 120,
  }).notNull(),

  email: varchar("email", {
    length: 150,
  }).notNull(),

  password: varchar("password", {
    length: 255,
  }).notNull(),

  role: varchar("role", {
    length: 30,
  })
    .default("OWNER")
    .notNull(),

  isActive: boolean("is_active").default(true).notNull(),

  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),

  lockedUntil: timestamp("locked_until"),

  lastLogin: timestamp("last_login"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
