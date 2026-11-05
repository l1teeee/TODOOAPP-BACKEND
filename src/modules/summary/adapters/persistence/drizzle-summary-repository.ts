import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { activitiesTable } from "../../../activities/public.js";
import type { SummaryRepository } from "../../application/ports.js";

export function createDrizzleSummaryRepository(db: DbExecutor): SummaryRepository {
  const get = db
    .select({
      todo: sql<number>`count(*) filter (where ${activitiesTable.status} = 'todo')`.mapWith(Number),
      inProgress:
        sql<number>`count(*) filter (where ${activitiesTable.status} = 'in_progress')`.mapWith(
          Number,
        ),
      completed:
        sql<number>`count(*) filter (where ${activitiesTable.status} = 'completed')`.mapWith(
          Number,
        ),
      habit: sql<number>`count(*) filter (where ${activitiesTable.kind} = 'habit')`.mapWith(Number),
      reminder: sql<number>`count(*) filter (where ${activitiesTable.kind} = 'reminder')`.mapWith(
        Number,
      ),
      task: sql<number>`count(*) filter (where ${activitiesTable.kind} = 'task')`.mapWith(Number),
      completedLast7Days: sql<number>`count(*) filter (where ${activitiesTable.status} = 'completed'
          and ${activitiesTable.completedAt} >= now() - interval '7 days')`.mapWith(Number),
      overdueReminders: sql<number>`count(*) filter (where ${activitiesTable.kind} = 'reminder'
          and ${activitiesTable.status} <> 'completed' and ${activitiesTable.scheduledDate} < ${sql.placeholder("today")}::date)`.mapWith(
        Number,
      ),
    })
    .from(activitiesTable)
    .where(
      and(eq(activitiesTable.userId, sql.placeholder("userId")), isNull(activitiesTable.deletedAt)),
    )
    .prepare("summary_get");

  return {
    async get(userId, today) {
      const [row] = await get.execute({ userId, today });
      if (!row) {
        throw new Error("Summary query returned no row");
      }
      return {
        byStatus: { todo: row.todo, inProgress: row.inProgress, completed: row.completed },
        byKind: { habit: row.habit, reminder: row.reminder, task: row.task },
        completedLast7Days: row.completedLast7Days,
        overdueReminders: row.overdueReminders,
      };
    },
  };
}
