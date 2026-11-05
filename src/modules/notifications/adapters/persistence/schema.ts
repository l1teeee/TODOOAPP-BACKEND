import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import { activitiesTable } from "../../../activities/public.js";

export const emailOutboxStatus = pgEnum("email_outbox_status", [
  "pending",
  "sending",
  "sent",
  "failed",
]);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    toEmail: text().notNull(),
    subject: text().notNull(),
    html: text().notNull(),
    text: text().notNull(),
    status: emailOutboxStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("email_outbox_due_idx")
      .on(table.nextAttemptAt)
      .where(sql`${table.status} = 'pending'`),
    index("email_outbox_sending_idx")
      .on(table.lockedAt)
      .where(sql`${table.status} = 'sending'`),
  ],
);

export const reminderNotifications = pgTable(
  "reminder_notifications",
  {
    activityId: uuid()
      .notNull()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),
    remindAt: timestamp({ withTimezone: true }).notNull(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.remindAt] })],
);
