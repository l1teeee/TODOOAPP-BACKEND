import type { AppModule, ModuleContext } from "../platform/modules/app-module.js";
import { createActivitiesModule } from "./activities/module.js";

export function buildModules(context: ModuleContext): AppModule[] {
  const activities = createActivitiesModule(context);
  // Satellites are created after activities and receive activities.extensions and activities.access.
  // Remove a satellite by deleting its folder and its lines here.
  return [activities.module];
}
