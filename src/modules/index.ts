import type { AppModule, ModuleContext } from "../platform/modules/app-module.js";
import { createActivitiesModule } from "./activities/module.js";
import { isAiAssistantEnabled } from "./ai-assistant/config.js";
import { createAiAssistantModule } from "./ai-assistant/module.js";
import { createAuthGatewayModule } from "./auth-gateway/module.js";

export function buildModules(context: ModuleContext): AppModule[] {
  const activities = createActivitiesModule(context);
  // Satellites are created after activities and receive activities.extensions and activities.access.
  // Remove a satellite by deleting its folder and its lines here.
  const modules: AppModule[] = [activities.module, createAuthGatewayModule(context)];
  if (isAiAssistantEnabled(context.env)) {
    modules.push(createAiAssistantModule(context));
  }
  return modules;
}
