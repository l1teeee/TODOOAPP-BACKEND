import { and, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type { ActivityAccess } from "../../public.js";
import { activities } from "./schema.js";

export function createActivityAccess(db: DbExecutor): ActivityAccess {
  return {
    async findOwned({ userId, activityId }) {
      const [activity] = await db
        .select({ id: activities.id, kind: activities.kind, title: activities.title })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            eq(activities.id, activityId),
            isNull(activities.deletedAt),
          ),
        );
      return activity ?? null;
    },
  };
}
