import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import { activitiesTable } from "../../../activities/public.js";

export const subtasks = pgTable(
  "subtasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    activityId: uuid()
      .notNull()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text().notNull(),
    isDone: boolean().notNull().default(false),
    position: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("subtasks_activity_position_idx").on(table.activityId, table.position)],
);
