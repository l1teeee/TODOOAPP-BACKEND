import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { AppConfig } from "../config/env.js";

export interface Database {
  db: NodePgDatabase;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export type DbExecutor = NodePgDatabase;

export function createDatabase(config: AppConfig["database"]): Database {
  const pool = new Pool({
    connectionString: config.url,
    max: config.poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: config.ssl ? true : undefined,
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
