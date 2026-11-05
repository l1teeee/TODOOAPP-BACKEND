import { register, supportsSyncHooks } from "import-in-the-middle/register-hooks.mjs";
import type { ServiceName } from "./observability-config.js";

export async function bootstrapTelemetry(serviceName: ServiceName): Promise<void> {
  if (!supportsSyncHooks()) {
    throw new Error("Telemetry needs Node.js 24.11.1 or newer for synchronous module hooks");
  }
  // ESM imports pino and pg; CommonJS requires (fastify to http, pg to pg-pool) are patched without the loader.
  register({ include: ["pino", "pg"] });
  // The dynamic import makes the hook load before any instrumented module.
  const { startTelemetry } = await import("./telemetry.js");
  startTelemetry(serviceName);
}
