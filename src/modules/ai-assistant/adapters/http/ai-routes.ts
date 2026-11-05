import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import type { SubtaskSuggester } from "../../application/ports.js";
import { suggestSubtasks } from "../../application/suggest-subtasks.js";

export function registerAiRoutes(
  server: HttpServer,
  context: ModuleContext,
  suggester: SubtaskSuggester,
): void {
  server.post(
    "/ai/subtask-suggestions",
    {
      onRequest: [context.requireUser],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 60_000,
          hook: "preHandler",
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
      schema: {
        security: [{ bearerAuth: [] }],
        tags: ["ai"],
        body: z.strictObject({
          title: z.string().trim().min(1).max(120),
          description: z.string().trim().max(500).nullable().optional(),
        }),
        response: { 200: z.object({ suggestions: z.array(z.string()) }) },
      },
    },
    async (request) => ({
      suggestions: await suggestSubtasks(suggester, {
        title: request.body.title,
        description: request.body.description ?? null,
      }),
    }),
  );
}
