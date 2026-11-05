import { buildModules } from "./modules/index.js";
import { loadConfig } from "./platform/config/env.js";
import { createPlatform } from "./platform/context/create-platform.js";
import { runJobs } from "./platform/jobs/run-jobs.js";
import { createLogger } from "./platform/logging/create-logger.js";
import { shutdownTelemetry } from "./platform/observability/telemetry.js";

const config = loadConfig(process.env);
const logger = createLogger(config);
const { database, context } = createPlatform({ config, env: process.env, logger });
const modules = buildModules(context);
const jobs = modules.flatMap((module) => module.jobs ?? []);
const runner = runJobs(jobs, logger);
logger.info({ jobs: jobs.map((job) => job.name) }, "Worker started");

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  logger.info(`Received ${signal}`);
  setTimeout(() => process.exit(1), 10_000).unref();
  try {
    await runner.stop();
    await database.close();
    await shutdownTelemetry();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Worker shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
