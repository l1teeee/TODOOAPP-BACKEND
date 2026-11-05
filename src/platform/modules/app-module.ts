import type { AppConfig } from "../config/env.js";
import type { FastifyBaseLogger, preHandlerAsyncHookHandler } from "fastify";
import type { DbExecutor } from "../db/database.js";
import type { EmailSender } from "../email/email-sender.js";
import type { EventBus } from "../events/event-bus.js";
import type { HttpServer } from "../http/http-server.js";
import type { BackgroundJob } from "../jobs/background-job.js";

export interface ModuleContext {
  readonly config: AppConfig;
  readonly env: NodeJS.ProcessEnv;
  readonly logger: FastifyBaseLogger;
  readonly db: DbExecutor;
  readonly events: EventBus;
  readonly email: EmailSender;
  readonly requireUser: preHandlerAsyncHookHandler;
}
export interface AppModule {
  readonly name: string;
  registerRoutes?(server: HttpServer): Promise<void>;
  readonly jobs?: readonly BackgroundJob[];
}

export type ModuleFactory = (context: ModuleContext) => AppModule;
