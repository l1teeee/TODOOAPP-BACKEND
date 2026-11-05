import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../logging/create-logger.js";
import { createDatabase } from "./database.js";

try {
  const config = loadConfig(process.env);
  const logger = createLogger(config);
  const database = createDatabase(config.database, logger);
  try {
    await migrate(database.db, { migrationsFolder: "drizzle" });
  } finally {
    await database.close();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
