import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyBaseLogger } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import { sql } from "drizzle-orm";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { AppConfig } from "../config/env.js";
import { registerMeRoutes } from "../identity/adapters/http/me-routes.js";
import { createDrizzleProfileRepository } from "../identity/adapters/persistence/drizzle-profile-repository.js";
import type { AppModule, ModuleContext } from "../modules/app-module.js";
import { registerErrorHandling } from "./error-handler.js";
import type { HttpServer } from "./http-server.js";
import { registerSystemRoutes } from "./system-routes.js";

const MAX_BODY_BYTES = 100 * 1024;

export async function createServer(options: {
  config: AppConfig;
  logger: FastifyBaseLogger;
  modules: readonly AppModule[];
  context: ModuleContext;
}): Promise<HttpServer> {
  const { config, logger, modules, context } = options;
  const server = Fastify({
    loggerInstance: logger,
    bodyLimit: MAX_BODY_BYTES,
    trustProxy:
      config.http.trustProxyHops > 0
        ? (_address: string, hop: number) => hop < config.http.trustProxyHops
        : false,
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();
  server.decorateRequest("user", null);
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.addHook("onSend", (request, reply, _payload, done) => {
    reply.header("x-request-id", request.id);
    done();
  });
  await server.register(helmet);
  await server.register(cors, {
    origin: config.http.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 600,
  });
  await server.register(rateLimit, {
    max: config.http.rateLimit.max,
    timeWindow: config.http.rateLimit.windowMs,
  });
  await server.register(swagger, {
    openapi: {
      info: { title: "TODO App API", version: "0.1.0" },
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      },
    },
    transform: jsonSchemaTransform,
  });
  registerErrorHandling(server);
  registerSystemRoutes(server, {
    moduleNames: modules.map((module) => module.name),
    exposeOpenApi: config.nodeEnv !== "production",
    async ping() {
      await context.db.execute(sql`select 1`);
    },
  });
  await server.register(
    (scope, _options, done) => {
      registerMeRoutes(scope, {
        profiles: createDrizzleProfileRepository(context.db),
        requireUser: context.requireUser,
      });
      done();
    },
    { prefix: "/v1" },
  );
  for (const module of modules) {
    await server.register(
      async (scope) => {
        await module.registerRoutes?.(scope);
      },
      { prefix: "/v1" },
    );
  }
  return server;
}
