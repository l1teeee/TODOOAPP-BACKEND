import { pino } from "pino";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import { serializeError } from "./redact-sensitive-text.js";

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    serializers: {
      err: serializeError,
    },
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "email",
      "*.email",
      "*.apiKey",
      "*.password",
      "*.token",
      "*.secret",
      'req.headers["x-api-key"]',
    ],
  });
}
