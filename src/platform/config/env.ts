import { z } from "zod";

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .refine((items) => items.length > 0 && items.every(isOrigin)),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  http: {
    host: string;
    port: number;
    corsOrigins: string[];
    trustProxyHops: number;
    rateLimit: { max: number; windowMs: number };
  };
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid environment: ${[...new Set(result.error.issues.map((issue) => String(issue.path[0])))].join(", ")}`,
    );
  }
  const value = result.data;
  return {
    nodeEnv: value.NODE_ENV,
    logLevel: value.LOG_LEVEL,
    http: {
      host: value.HOST,
      port: value.PORT,
      corsOrigins: value.CORS_ORIGINS,
      trustProxyHops: value.TRUST_PROXY_HOPS,
      rateLimit: { max: value.RATE_LIMIT_MAX, windowMs: value.RATE_LIMIT_WINDOW_MS },
    },
  };
}
