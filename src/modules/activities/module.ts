import { and, eq, isNull } from "drizzle-orm";
import type { ModuleContext } from "../../platform/modules/app-module.js";
import { createActivityPresenter } from "./adapters/http/activity-presenter.js";
import { registerActivityRoutes } from "./adapters/http/activity-routes.js";
import { createDrizzleActivityRepository } from "./adapters/persistence/drizzle-activity-repository.js";
import { activities } from "./adapters/persistence/schema.js";
import { createExtensionPoints } from "./extension-points.js";
import type { ActivitiesModule } from "./public.js";

export function createActivitiesModule(context: ModuleContext): ActivitiesModule {
  const extensions = createExtensionPoints();
  const repository = createDrizzleActivityRepository(context.db, extensions);
  const presentActivities = createActivityPresenter(extensions);
  return {
    module: {
      name: "activities",
      registerRoutes(server) {
        registerActivityRoutes(server, { context, repository, extensions, presentActivities });
        return Promise.resolve();
      },
    },
    extensions,
    access: {
      async findOwned({ userId, activityId }) {
        const [activity] = await context.db
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
    },
  };
}
