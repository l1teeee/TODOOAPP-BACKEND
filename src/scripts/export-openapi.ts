import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { appModules } from "../modules/index.js";
import { loadConfig } from "../platform/config/env.js";
import { createServer } from "../platform/http/create-server.js";

const config = loadConfig(process.env);
const server = await createServer({ config, modules: appModules, context: { config } });
await server.ready();
const path = new URL("../../openapi.json", import.meta.url);
await writeFile(path, JSON.stringify(server.swagger(), null, 2) + "\n");
await server.close();
console.log(`Wrote ${fileURLToPath(path)}`);
