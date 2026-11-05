import type { AppModule, ModuleContext } from "../../platform/modules/app-module.js";
import { registerSummaryRoutes } from "./adapters/http/summary-routes.js";
import { createDrizzleSummaryRepository } from "./adapters/persistence/drizzle-summary-repository.js";

export function createSummaryModule(context: ModuleContext): AppModule {
  const repository = createDrizzleSummaryRepository(context.db);
  return {
    name: "summary",
    registerRoutes(server) {
      registerSummaryRoutes(server, { context, repository });
      return Promise.resolve();
    },
  };
}
