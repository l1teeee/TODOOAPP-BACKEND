import { and, count, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "../../../../platform/db/postgres-errors.js";
import type { ListRepository } from "../../application/ports.js";
import { listNameTaken, listNotFound } from "../../domain/list-errors.js";
import { lists } from "./schema.js";

export function createDrizzleListRepository(db: DbExecutor): ListRepository {
  const list = db
    .select()
    .from(lists)
    .where(eq(lists.userId, sql.placeholder("userId")))
    .orderBy(lists.position, lists.createdAt)
    .prepare("lists_list");

  return {
    list(userId) {
      return list.execute({ userId });
    },
    async count(userId) {
      const [row] = await db.select({ count: count() }).from(lists).where(eq(lists.userId, userId));
      if (!row) {
        throw new Error("List count returned no row");
      }
      return row.count;
    },
    async create(userId, fields) {
      try {
        const [row] = await db
          .insert(lists)
          .values({
            ...fields,
            userId,
            position: sql`(select coalesce(max(${lists.position}), -1) + 1 from ${lists} where ${lists.userId} = ${userId})`,
          })
          .returning();
        if (!row) {
          throw new Error("List insert returned no row");
        }
        return row;
      } catch (error) {
        if (isUniqueViolation(error, "lists_user_name_unique")) {
          throw listNameTaken();
        }
        if (isForeignKeyViolation(error)) {
          throw listNotFound();
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
        if (isUniqueViolation(error, "lists_user_name_unique")) {
          throw listNameTaken();
        }
        if (isForeignKeyViolation(error)) {
          throw listNotFound();
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
