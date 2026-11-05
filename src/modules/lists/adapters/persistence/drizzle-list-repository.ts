import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type { ListRepository } from "../../application/ports.js";
import { listNameTaken } from "../../domain/list-errors.js";
import { lists } from "./schema.js";

function isNameConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "lists_user_name_unique"
  ) {
    return true;
  }
  return error instanceof Error && isNameConflict(error.cause);
}

export function createDrizzleListRepository(db: DbExecutor): ListRepository {
  return {
    list(userId) {
      return db
        .select()
        .from(lists)
        .where(eq(lists.userId, userId))
        .orderBy(lists.position, lists.createdAt);
    },
    async create(userId, fields) {
      try {
        const [row] = await db
          .insert(lists)
          .values({ ...fields, userId })
          .returning();
        if (!row) {
          throw new Error("List insert returned no row");
        }
        return row;
      } catch (error) {
        if (isNameConflict(error)) {
          throw listNameTaken();
        }
        throw error;
      }
    },
    async update(userId, id, patch) {
      try {
        const [row] = await db
          .update(lists)
          .set({ ...patch, updatedAt: sql`now()` })
          .where(and(eq(lists.userId, userId), eq(lists.id, id)))
          .returning();
        return row ?? null;
      } catch (error) {
        if (isNameConflict(error)) {
          throw listNameTaken();
        }
        throw error;
      }
    },
    async delete(userId, id) {
      const rows = await db
        .delete(lists)
        .where(and(eq(lists.userId, userId), eq(lists.id, id)))
        .returning({ id: lists.id });
      return rows.length > 0;
    },
  };
}
