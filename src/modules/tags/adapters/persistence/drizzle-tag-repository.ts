import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type { TagRepository } from "../../application/ports.js";
import { tagNameTaken } from "../../domain/tag-errors.js";
import { tags } from "./schema.js";

function isNameConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "tags_user_name_unique"
  ) {
    return true;
  }
  return error instanceof Error && isNameConflict(error.cause);
}

export function createDrizzleTagRepository(db: DbExecutor): TagRepository {
  return {
    list(userId) {
      return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
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
        if (isNameConflict(error)) {
          throw tagNameTaken();
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
        if (isNameConflict(error)) {
          throw tagNameTaken();
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
