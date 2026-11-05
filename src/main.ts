import { buildModules } from "./modules/index.js";
import { loadConfig } from "./platform/config/env.js";
import { createPlatform } from "./platform/context/create-platform.js";
import { createServer } from "./platform/http/create-server.js";
import { createLogger } from "./platform/logging/create-logger.js";
import { shutdownTelemetry } from "./platform/observability/telemetry.js";

const config = loadConfig(process.env);
const logger = createLogger(config);
const { database, context } = createPlatform({ config, env: process.env, logger });
const modules = buildModules(context);
const server = await createServer({ config, logger, modules, context });
server.addHook("onClose", () => database.close());
await server.listen({ host: config.http.host, port: config.http.port });

async function shutdown(signal: string): Promise<void> {
  server.log.info(`Received ${signal}`);
  setTimeout(() => process.exit(1), 10_000).unref();
  try {
    await server.close();
    await shutdownTelemetry();
    process.exit(0);
  } catch (error) {
    server.log.error({ err: error }, "Shutdown failed");
    process.exit(1);
  }
}
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
