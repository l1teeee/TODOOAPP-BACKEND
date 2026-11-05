import { moduleFactories } from "./modules/index.js";
import { loadConfig } from "./platform/config/env.js";
import { createPlatform } from "./platform/context/create-platform.js";
import { createServer } from "./platform/http/create-server.js";
import { createLogger } from "./platform/logging/create-logger.js";

const config = loadConfig(process.env);
const logger = createLogger(config);
const { database, context } = createPlatform({ config, env: process.env, logger });
const modules = moduleFactories.map((factory) => factory(context));
const server = await createServer({ config, logger, modules, context });
server.addHook("onClose", () => database.close());
await server.listen({ host: config.http.host, port: config.http.port });

async function shutdown(signal: string): Promise<void> {
  server.log.info(`Received ${signal}`);
  setTimeout(() => process.exit(1), 10_000).unref();
  await server.close();
  process.exit(0);
}
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
