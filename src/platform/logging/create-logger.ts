import { pino } from "pino";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.apiKey",
      "*.password",
      "*.token",
      "*.secret",
      'req.headers["x-api-key"]',
    ],
  });
}
