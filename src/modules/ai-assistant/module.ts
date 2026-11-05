import type { AppModule, ModuleContext } from "../../platform/modules/app-module.js";
import { createDeepinfraTextGenerator } from "./adapters/deepinfra-text-generator.js";
import { registerAiRoutes } from "./adapters/http/ai-routes.js";
import { loadAiAssistantConfig } from "./config.js";

export function createAiAssistantModule(context: ModuleContext): AppModule {
  const config = loadAiAssistantConfig(context.env);
  const suggester = createDeepinfraTextGenerator({
    apiKey: config.DEEPINFRA_API_KEY,
    model: config.DEEPINFRA_MODEL,
    timeoutMs: config.AI_TIMEOUT_MS,
    logger: context.logger,
  });
  return {
    name: "ai-assistant",
    registerRoutes(server) {
      registerAiRoutes(server, context, suggester);
      return Promise.resolve();
    },
  };
}
