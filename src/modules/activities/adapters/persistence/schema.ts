import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";

export const activityKind = pgEnum("activity_kind", ["habit", "reminder", "task"]);
export const activityStatus = pgEnum("activity_status", ["todo", "in_progress", "completed"]);

export const activities = pgTable(
  "activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: activityKind().notNull(),
    title: text().notNull(),
    description: text(),
    status: activityStatus().notNull().default("todo"),
    scheduledDate: date({ mode: "string" }),
    startTime: time(),
    endTime: time(),
    location: text(),
    icon: text(),
    completedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activities_user_date_idx")
      .on(table.userId, table.scheduledDate)
      .where(sql`${table.deletedAt} is null`),
    index("activities_user_completed_idx")
      .on(table.userId, table.completedAt.desc(), table.id.desc())
      .where(sql`${table.status} = 'completed' and ${table.deletedAt} is null`),
    index("activities_user_trash_idx")
      .on(table.userId, table.deletedAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is not null`),
    check(
      "activities_time_order",
      sql`${table.endTime} is null or ${table.startTime} is null or ${table.endTime} > ${table.startTime}`,
    ),
  ],
);
