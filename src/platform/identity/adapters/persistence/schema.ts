import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid().primaryKey(),
  email: text().notNull(),
  displayName: text(),
  timezone: text().notNull().default("UTC"),
  emailNotifications: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
