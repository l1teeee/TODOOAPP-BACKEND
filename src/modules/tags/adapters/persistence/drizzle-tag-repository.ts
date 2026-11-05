import { and, count, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "../../../../platform/db/postgres-errors.js";
import type { TagRepository } from "../../application/ports.js";
import { tagNameTaken, tagNotFound } from "../../domain/tag-errors.js";
import { tags } from "./schema.js";

export function createDrizzleTagRepository(db: DbExecutor): TagRepository {
  return {
    list(userId) {
      return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
    },
    async count(userId) {
      const [row] = await db.select({ count: count() }).from(tags).where(eq(tags.userId, userId));
      if (!row) {
        throw new Error("Tag count returned no row");
      }
      return row.count;
    },
    async create(userId, fields) {
      try {
        const [row] = await db
          .insert(tags)
          .values({ ...fields, userId })
          .returning();
        if (!row) {
          throw new Error("Tag insert returned no row");
        }
        return row;
      } catch (error) {
        if (isUniqueViolation(error, "tags_user_name_unique")) {
          throw tagNameTaken();
        }
        if (isForeignKeyViolation(error)) {
          throw tagNotFound();
        }
        throw error;
      }
    },
    async update(userId, id, patch) {
      try {
        const [row] = await db
          .update(tags)
          .set({ ...patch, updatedAt: sql`now()` })
          .where(and(eq(tags.userId, userId), eq(tags.id, id)))
          .returning();
        return row ?? null;
      } catch (error) {
        if (isUniqueViolation(error, "tags_user_name_unique")) {
          throw tagNameTaken();
        }
        if (isForeignKeyViolation(error)) {
          throw tagNotFound();
        }
        throw error;
      }
    },
    async delete(userId, id) {
      const rows = await db
        .delete(tags)
        .where(and(eq(tags.userId, userId), eq(tags.id, id)))
        .returning({ id: tags.id });
      return rows.length > 0;
    },
  };
}
