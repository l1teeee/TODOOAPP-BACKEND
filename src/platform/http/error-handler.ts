import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { AppError } from "../errors/app-error.js";
import type { AppErrorKind } from "../errors/app-error.js";
import type { HttpServer } from "./http-server.js";

const statuses: Record<AppErrorKind, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unavailable: 503,
};

export function registerErrorHandling(server: HttpServer): void {
  server.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.validation,
        },
      });
    }
    if (isResponseSerializationError(error)) {
      request.log.error(error);
      return reply
        .status(500)
        .send({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    }
    if (error instanceof AppError) {
      return reply
        .status(statuses[error.kind])
        .send({ error: { code: error.code, message: error.message } });
    }
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode <= 499
    ) {
      return reply.status(error.statusCode).send({
        error: {
          code: "code" in error && typeof error.code === "string" ? error.code : "REQUEST_ERROR",
          message: error.message,
        },
      });
    }
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });
  server.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } }),
  );
}
