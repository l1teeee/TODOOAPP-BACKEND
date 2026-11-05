import type { AppModule, ModuleContext } from "../../platform/modules/app-module.js";
import type { ActivitiesModule } from "../activities/public.js";
import { registerSubtaskRoutes } from "./adapters/http/subtask-routes.js";
import { createDrizzleSubtaskRepository } from "./adapters/persistence/drizzle-subtask-repository.js";
import { createSubtaskProgressExtension } from "./adapters/persistence/subtask-progress-extension.js";
import { createSubtaskUseCases } from "./application/subtask-use-cases.js";

export function createSubtasksModule(
  context: ModuleContext,
  activities: Pick<ActivitiesModule, "extensions" | "access">,
): AppModule {
  const repository = createDrizzleSubtaskRepository(context.db);
  const useCases = createSubtaskUseCases({
    repository,
    access: activities.access,
    events: context.events,
  });
  activities.extensions.addView(createSubtaskProgressExtension(context.db));
  return {
    name: "subtasks",
    registerRoutes(server) {
      registerSubtaskRoutes(server, context, useCases);
      return Promise.resolve();
    },
  };
}
