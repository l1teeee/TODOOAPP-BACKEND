import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import { activitiesTable } from "../../../activities/public.js";

export const lists = pgTable(
  "lists",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text().notNull(),
    icon: text().notNull(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("lists_user_name_unique").on(table.userId, sql`lower(${table.name})`)],
);

export const activityLists = pgTable(
  "activity_lists",
  {
    activityId: uuid()
      .primaryKey()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),
    listId: uuid()
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [index("activity_lists_list_idx").on(table.listId)],
);
