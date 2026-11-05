import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import { currentUser } from "../../../../platform/identity/adapters/http/require-user.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import type { SummaryRepository } from "../../application/ports.js";

const dateSchema = z.iso.date().refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a real date in YYYY-MM-DD format");
const countSchema = z.number().int().nonnegative();
const summarySchema = z.object({
  byStatus: z.object({ todo: countSchema, inProgress: countSchema, completed: countSchema }),
  byKind: z.object({ habit: countSchema, reminder: countSchema, task: countSchema }),
  completedLast7Days: countSchema,
  overdueReminders: countSchema,
});

export function registerSummaryRoutes(
  server: HttpServer,
  deps: { context: ModuleContext; repository: SummaryRepository },
): void {
  server.get(
    "/summary",
    {
      onRequest: [deps.context.requireUser],
      schema: {
        security: [{ bearerAuth: [] }],
        tags: ["summary"],
        querystring: z.strictObject({ today: dateSchema }),
        response: { 200: summarySchema },
      },
    },
    (request) => deps.repository.get(currentUser(request).id, request.query.today),
  );
}
