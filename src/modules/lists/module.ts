import type { AppModule, ModuleContext } from "../../platform/modules/app-module.js";
import type { ActivitiesModule } from "../activities/public.js";
import { registerListRoutes } from "./adapters/http/list-routes.js";
import { createDrizzleListRepository } from "./adapters/persistence/drizzle-list-repository.js";
import { registerListActivityExtensions } from "./adapters/persistence/list-activity-extensions.js";

export function createListsModule(
  context: ModuleContext,
  activities: Pick<ActivitiesModule, "extensions">,
): AppModule {
  const repository = createDrizzleListRepository(context.db);
  registerListActivityExtensions(context.db, activities.extensions);
  return {
    name: "lists",
    registerRoutes(server) {
      registerListRoutes(server, { context, repository });
      return Promise.resolve();
    },
  };
}
