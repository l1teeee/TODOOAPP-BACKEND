import { z } from "zod";
import type { HttpServer } from "./http-server.js";

export function registerSystemRoutes(
  server: HttpServer,
  options: { moduleNames: readonly string[]; exposeOpenApi: boolean; ping(): Promise<void> },
): void {
  server.get(
    "/health",
    { schema: { response: { 200: z.object({ status: z.literal("ok") }) } } },
    () => ({ status: "ok" as const }),
  );
  server.get(
    "/health/ready",
    {
      schema: {
        response: {
          200: z.object({ status: z.literal("ready") }),
          503: z.object({
            error: z.object({
              code: z.literal("DATABASE_UNAVAILABLE"),
              message: z.literal("Database unavailable"),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        await options.ping();
        return await reply.status(200).send({ status: "ready" });
      } catch (error) {
        request.log.error({ err: error }, "Database readiness check failed");
        return reply
          .status(503)
          .send({ error: { code: "DATABASE_UNAVAILABLE", message: "Database unavailable" } });
      }
    },
  );
  server.get(
    "/v1/meta",
    { schema: { response: { 200: z.object({ modules: z.array(z.string()) }) } } },
    () => ({ modules: [...options.moduleNames] }),
  );
  if (options.exposeOpenApi) {
    server.get("/openapi.json", { schema: { hide: true } }, () => server.swagger());
  }
}
