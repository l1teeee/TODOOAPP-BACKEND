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

const clientMessages: Record<number, string> = {
  400: "Bad request",
  404: "Not found",
  413: "Payload too large",
  415: "Unsupported media type",
  429: "Too many requests",
};

function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

function isClientError(error: unknown): error is Error & { statusCode: number; code?: string } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode <= 499
  );
}

export function registerErrorHandling(server: HttpServer): void {
  server.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = error.validation.map((issue) => ({
        path: issue.instancePath,
        message: issue.message,
      }));
      return reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", "Request validation failed", details));
    }
    if (isResponseSerializationError(error)) {
      request.log.error(error);
      return reply.status(500).send(errorBody("INTERNAL_ERROR", "Internal server error"));
    }
    if (error instanceof AppError) {
      return reply.status(statuses[error.kind]).send(errorBody(error.code, error.message));
    }
    if (isClientError(error)) {
      return reply
        .status(error.statusCode)
        .send(
          errorBody(
            typeof error.code === "string" ? error.code : "REQUEST_ERROR",
            clientMessages[error.statusCode] ?? "Request error",
          ),
        );
    }
    request.log.error(error);
    return reply.status(500).send(errorBody("INTERNAL_ERROR", "Internal server error"));
  });
  server.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(errorBody("ROUTE_NOT_FOUND", "Not found")),
  );
}
