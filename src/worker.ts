import { moduleFactories } from "./modules/index.js";
import { loadConfig } from "./platform/config/env.js";
import { createPlatform } from "./platform/context/create-platform.js";
import { runJobs } from "./platform/jobs/run-jobs.js";
import { createLogger } from "./platform/logging/create-logger.js";

const config = loadConfig(process.env);
const logger = createLogger(config);
const { database, context } = createPlatform({ config, env: process.env, logger });
const modules = moduleFactories.map((factory) => factory(context));
const jobs = modules.flatMap((module) => module.jobs ?? []);
const runner = runJobs(jobs, logger);
logger.info({ jobs: jobs.map((job) => job.name) }, "Worker started");

// Keep an empty worker alive while no feature modules declare jobs.
const keepAlive = setInterval(() => undefined, 60_000);
let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  logger.info(`Received ${signal}`);
  setTimeout(() => process.exit(1), 10_000).unref();
  clearInterval(keepAlive);
  try {
    await runner.stop();
    await database.close();
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
