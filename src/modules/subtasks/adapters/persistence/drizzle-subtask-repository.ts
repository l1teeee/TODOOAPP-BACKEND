import { and, asc, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type { SubtaskRepository } from "../../application/ports.js";
import { subtasks } from "./schema.js";

const subtaskFields = {
  id: subtasks.id,
  activityId: subtasks.activityId,
  title: subtasks.title,
  isDone: subtasks.isDone,
  position: subtasks.position,
};

export function createDrizzleSubtaskRepository(db: DbExecutor): SubtaskRepository {
  return {
    list(userId, activityId) {
      return db
        .select(subtaskFields)
        .from(subtasks)
        .where(and(eq(subtasks.userId, userId), eq(subtasks.activityId, activityId)))
        .orderBy(asc(subtasks.position), asc(subtasks.createdAt));
    },
    async createMany(userId, activityId, titles) {
      return db.transaction(async (tx) => {
        const [result] = await tx
          .select({
            position: sql<number>`coalesce(max(${subtasks.position}), -1)`.mapWith(Number),
          })
          .from(subtasks)
          .where(and(eq(subtasks.userId, userId), eq(subtasks.activityId, activityId)));
        if (!result) {
          throw new Error("Subtask maximum position query returned no row");
        }
        const rows = titles.map((title, index) => ({
          userId,
          activityId,
          title,
          position: result.position + index + 1,
        }));
        return tx.insert(subtasks).values(rows).returning(subtaskFields);
      });
    },
    async update(userId, id, patch) {
      const [row] = await db
        .update(subtasks)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(and(eq(subtasks.id, id), eq(subtasks.userId, userId)))
        .returning(subtaskFields);
      return row ?? null;
    },
    async remove(userId, id) {
      const rows = await db
        .delete(subtasks)
        .where(and(eq(subtasks.id, id), eq(subtasks.userId, userId)))
        .returning({ id: subtasks.id });
      return rows.length > 0;
    },
  };
}
