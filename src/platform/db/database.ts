import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../config/env.js";

export interface Database {
  db: NodePgDatabase;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export type DbExecutor = NodePgDatabase;

export function createDatabase(config: AppConfig["database"], logger: FastifyBaseLogger): Database {
  const pool = new Pool({
    connectionString: config.url,
    max: config.poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: config.ssl ? true : undefined,
  });
  pool.on("error", (error) => {
    logger.error({ err: error, event: "database.pool_error" }, "Idle database connection error");
  });
  return {
    db: drizzle({ client: pool, casing: "snake_case" }),
    async ping() {
      await pool.query("select 1");
    },
    async close() {
      await pool.end();
    },
  };
}
