import { appModules } from "./modules/index.js";
import { loadConfig } from "./platform/config/env.js";
import { createServer } from "./platform/http/create-server.js";

const config = loadConfig(process.env);
const server = await createServer({ config, modules: appModules, context: { config } });
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
