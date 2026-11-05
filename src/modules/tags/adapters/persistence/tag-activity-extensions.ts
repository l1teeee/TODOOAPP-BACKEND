import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { isForeignKeyViolation } from "../../../../platform/db/postgres-errors.js";
import { activitiesTable } from "../../../activities/public.js";
import type { ActivitiesExtensionPoints } from "../../../activities/public.js";
import { tagNotFound } from "../../domain/tag-errors.js";
import { activityTags, tags } from "./schema.js";

export function registerTagActivityExtensions(
  db: DbExecutor,
  extensions: ActivitiesExtensionPoints,
): void {
  extensions.addView({
    field: "tagIds",
    schema: z.array(z.uuid()),
    fallback: [],
    async load({ userId, activityIds }) {
      const rows = await db
        .select({ activityId: activityTags.activityId, tagId: activityTags.tagId })
        .from(activityTags)
        .where(and(eq(activityTags.userId, userId), inArray(activityTags.activityId, activityIds)));
      const grouped = new Map<string, string[]>();
      for (const row of rows) {
        const tagIds = grouped.get(row.activityId);
        if (tagIds) {
          tagIds.push(row.tagId);
        } else {
          grouped.set(row.activityId, [row.tagId]);
        }
      }
      return grouped;
    },
  });

  extensions.addFilter({
    param: "tagId",
    schema: z.uuid(),
    condition({ userId, value }) {
      return sql`exists (
        select 1 from ${activityTags}
        where ${activityTags.activityId} = ${activitiesTable.id}
          and ${activityTags.tagId} = ${value}
          and ${activityTags.userId} = ${userId}
      )`;
    },
  });

  extensions.addWrite({
    field: "tagIds",
    schema: z
      .array(z.uuid())
      .max(10)
      .refine(
        (value) => new Set(value.map((id) => id.toLowerCase())).size === value.length,
        "Tag ids must be unique",
      ),
    async apply({ executor, userId, activityId, value }) {
      const [owned] = await executor
        .select({ count: count() })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, value)));
      if (owned?.count !== value.length) {
        throw tagNotFound();
      }
      await executor
        .delete(activityTags)
        .where(and(eq(activityTags.userId, userId), eq(activityTags.activityId, activityId)));
      if (value.length > 0) {
        try {
          await executor
            .insert(activityTags)
            .values(value.map((tagId) => ({ userId, activityId, tagId })));
        } catch (error) {
          if (isForeignKeyViolation(error)) {
            throw tagNotFound();
          }
          throw error;
        }
      }
    },
  });
}
