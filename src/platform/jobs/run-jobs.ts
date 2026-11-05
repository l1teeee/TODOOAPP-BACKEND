import { setTimeout } from "node:timers/promises";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { FastifyBaseLogger } from "fastify";
import type { BackgroundJob } from "./background-job.js";

async function runTraced(job: BackgroundJob): Promise<void> {
  await trace
    .getTracer("todo-app.jobs")
    .startActiveSpan("job.run", { attributes: { "job.name": job.name } }, async (span) => {
      try {
        await job.run();
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
}

export function runJobs(
  jobs: readonly BackgroundJob[],
  logger: FastifyBaseLogger,
): { stop(): Promise<void> } {
  const controller = new AbortController();

  async function runLoop(job: BackgroundJob): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        await runTraced(job);
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
