import type { AppModule, ModuleContext } from "../../platform/modules/app-module.js";
import type { ActivitiesModule } from "../activities/public.js";
import { registerTagRoutes } from "./adapters/http/tag-routes.js";
import { createDrizzleTagRepository } from "./adapters/persistence/drizzle-tag-repository.js";
import { registerTagActivityExtensions } from "./adapters/persistence/tag-activity-extensions.js";

export function createTagsModule(
  context: ModuleContext,
  activities: Pick<ActivitiesModule, "extensions">,
): AppModule {
  const repository = createDrizzleTagRepository(context.db);
  registerTagActivityExtensions(context.db, activities.extensions);
  return {
    name: "tags",
    registerRoutes(server) {
      registerTagRoutes(server, { context, repository });
      return Promise.resolve();
    },
  };
}
