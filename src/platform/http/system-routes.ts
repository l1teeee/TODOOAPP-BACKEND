import { z } from "zod";
import type { HttpServer } from "./http-server.js";

export function registerSystemRoutes(
  server: HttpServer,
  options: { moduleNames: readonly string[]; exposeOpenApi: boolean },
): void {
  server.get(
    "/health",
    { schema: { response: { 200: z.object({ status: z.literal("ok") }) } } },
    () => ({ status: "ok" as const }),
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
