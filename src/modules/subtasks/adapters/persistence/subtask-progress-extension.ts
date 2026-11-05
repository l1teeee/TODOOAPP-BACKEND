import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type { ActivityViewExtension } from "../../../activities/public.js";
import { subtasks } from "./schema.js";

interface SubtaskProgress {
  done: number;
  total: number;
}

export function createSubtaskProgressExtension(
  db: DbExecutor,
): ActivityViewExtension<SubtaskProgress> {
  const load = db
    .select({
      activityId: subtasks.activityId,
      done: sql<number>`count(*) filter (where ${subtasks.isDone})`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(subtasks)
    .where(
      and(
        eq(subtasks.userId, sql.placeholder("userId")),
        sql`${subtasks.activityId} = any(${sql.placeholder("activityIds")}::uuid[])`,
      ),
    )
    .groupBy(subtasks.activityId)
    .prepare("subtasks_progress_load");

  return {
    field: "subtaskProgress",
    schema: z.object({ done: z.number().int().min(0), total: z.number().int().min(0) }),
    fallback: { done: 0, total: 0 },
    async load({ userId, activityIds }) {
      if (activityIds.length === 0) {
        return new Map<string, SubtaskProgress>();
      }
      const rows = await load.execute({ userId, activityIds });
      return new Map(rows.map((row) => [row.activityId, { done: row.done, total: row.total }]));
    },
  };
}
