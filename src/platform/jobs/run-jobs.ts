import { setTimeout } from "node:timers/promises";
import type { FastifyBaseLogger } from "fastify";
import type { BackgroundJob } from "./background-job.js";

export function runJobs(
  jobs: readonly BackgroundJob[],
  logger: FastifyBaseLogger,
): { stop(): Promise<void> } {
  const controller = new AbortController();

  async function runLoop(job: BackgroundJob): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        await job.run();
      } catch (error) {
        logger.error({ err: error, job: job.name }, "Background job failed");
      }
      try {
        await setTimeout(job.intervalMs, undefined, { signal: controller.signal });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        throw error;
      }
    }
  }

  const loops = jobs.map(runLoop);
  return {
    async stop() {
      controller.abort();
      await Promise.all(loops);
    },
  };
}
