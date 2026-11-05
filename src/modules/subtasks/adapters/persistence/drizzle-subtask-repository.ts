import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { AppError } from "../../../../platform/errors/app-error.js";
import { activitiesTable } from "../../../activities/public.js";
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
        // Serialize appends so concurrent creates share the capacity and position checks.
        const activityLockKey = `${userId}:${activityId}`;
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${activityLockKey}, 0))`,
        );
        const [result] = await tx
          .select({
            position: sql<number>`coalesce(max(${subtasks.position}), -1)`.mapWith(Number),
            total: sql<number>`count(*)`.mapWith(Number),
          })
          .from(subtasks)
          .where(and(eq(subtasks.userId, userId), eq(subtasks.activityId, activityId)));
        if (!result) {
          throw new Error("Subtask maximum position query returned no row");
        }
        if (result.total + titles.length > 100) {
          throw new AppError(
            "conflict",
            "SUBTASK_LIMIT_REACHED",
            "An activity can have at most 100 subtasks",
          );
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
        .from(activitiesTable)
        .where(
          and(
            eq(subtasks.id, id),
            eq(subtasks.userId, userId),
            eq(subtasks.activityId, activitiesTable.id),
            eq(activitiesTable.userId, userId),
            isNull(activitiesTable.deletedAt),
          ),
        )
        .returning(subtaskFields);
      return row ?? null;
    },
    async remove(userId, id) {
      const result = await db.execute<{ id: string }>(sql`
        delete from ${subtasks}
        using ${activitiesTable}
        where ${subtasks.id} = ${id}
          and ${subtasks.userId} = ${userId}
          and ${subtasks.activityId} = ${activitiesTable.id}
          and ${activitiesTable.userId} = ${userId}
          and ${activitiesTable.deletedAt} is null
        returning ${subtasks.id}
      `);
      return result.rows.length > 0;
    },
  };
}
