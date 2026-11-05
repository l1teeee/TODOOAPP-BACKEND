import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import { activitiesTable } from "../../../activities/public.js";
import { tagColors } from "../../domain/tag.js";

export const tagColor = pgEnum("tag_color", tagColors);

export const tags = pgTable(
  "tags",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: tagColor().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tags_user_name_unique").on(table.userId, sql`lower(${table.name})`)],
);

export const activityTags = pgTable(
  "activity_tags",
  {
    activityId: uuid()
      .notNull()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),
    tagId: uuid()
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.tagId] }),
    index("activity_tags_tag_idx").on(table.tagId),
  ],
);
