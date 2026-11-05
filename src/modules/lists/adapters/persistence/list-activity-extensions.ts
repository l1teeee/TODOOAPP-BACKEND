import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { activitiesTable } from "../../../activities/public.js";
import type { ActivitiesExtensionPoints } from "../../../activities/public.js";
import { listNotFound } from "../../domain/list-errors.js";
import { activityLists, lists } from "./schema.js";

export function registerListActivityExtensions(
  db: DbExecutor,
  extensions: ActivitiesExtensionPoints,
): void {
  extensions.addView({
    field: "listId",
    schema: z.uuid().nullable(),
    fallback: null,
    async load({ userId, activityIds }) {
      const rows = await db
        .select({ activityId: activityLists.activityId, listId: activityLists.listId })
        .from(activityLists)
        .where(
          and(eq(activityLists.userId, userId), inArray(activityLists.activityId, activityIds)),
        );
      return new Map(rows.map((row) => [row.activityId, row.listId]));
    },
  });

  extensions.addFilter({
    param: "listId",
    schema: z.uuid(),
    condition({ userId, value }) {
      return sql`exists (
        select 1 from ${activityLists}
        where ${activityLists.activityId} = ${activitiesTable.id}
          and ${activityLists.listId} = ${value}
          and ${activityLists.userId} = ${userId}
      )`;
    },
  });

  extensions.addWrite({
    field: "listId",
    schema: z.uuid().nullable(),
    async apply({ executor, userId, activityId, value }) {
      if (value === null) {
        await executor
          .delete(activityLists)
          .where(and(eq(activityLists.userId, userId), eq(activityLists.activityId, activityId)));
        return;
      }
      const [list] = await executor
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.userId, userId), eq(lists.id, value)));
      if (!list) {
        throw listNotFound();
      }
      await executor
        .insert(activityLists)
        .values({ userId, activityId, listId: value })
        .onConflictDoUpdate({
          target: activityLists.activityId,
          set: { listId: value },
          setWhere: eq(activityLists.userId, userId),
        });
    },
  });
}
