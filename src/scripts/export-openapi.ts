import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { moduleFactories } from "../modules/index.js";
import { loadConfig } from "../platform/config/env.js";
import { createPlatform } from "../platform/context/create-platform.js";
import { createServer } from "../platform/http/create-server.js";
import { createLogger } from "../platform/logging/create-logger.js";

const config = loadConfig(process.env);
const logger = createLogger(config);
const { database, context } = createPlatform({ config, env: process.env, logger });
const modules = moduleFactories.map((factory) => factory(context));
const server = await createServer({ config, logger, modules, context });
server.addHook("onClose", () => database.close());
try {
  await server.ready();
  const path = new URL("../../openapi.json", import.meta.url);
  await writeFile(path, JSON.stringify(server.swagger(), null, 2) + "\n");
  process.stdout.write(`Wrote ${fileURLToPath(path)}\n`);
} finally {
  await server.close();
}
