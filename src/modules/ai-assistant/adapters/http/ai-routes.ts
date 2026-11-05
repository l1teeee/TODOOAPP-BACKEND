import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import type { DailyBriefWriter, SubtaskSuggester } from "../../application/ports.js";
import { suggestSubtasks } from "../../application/suggest-subtasks.js";
import { writeDailyBrief } from "../../application/write-daily-brief.js";

export function registerAiRoutes(
  server: HttpServer,
  context: ModuleContext,
  suggester: SubtaskSuggester & DailyBriefWriter,
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
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  server.post(
    "/ai/daily-brief",
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
          firstName: z.string().trim().min(1).max(40).nullable(),
          localTime: time,
          locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
          items: z
            .array(
              z.strictObject({
                kind: z.enum(["habit", "reminder", "task"]),
                title: z.string().trim().min(1).max(120),
                startTime: time.nullable(),
                endTime: time.nullable(),
                location: z.string().trim().min(1).max(120).nullable(),
                status: z.enum(["todo", "in_progress", "completed"]),
              }),
            )
            .max(30),
        }),
        response: { 200: z.object({ message: z.string() }) },
      },
    },
    // The message is plain text; clients must render it as text, never HTML.
    async (request) => ({ message: await writeDailyBrief(suggester, request.body) }),
  );
}
