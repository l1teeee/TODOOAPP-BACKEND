import { z } from "zod";

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ORIGINS: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      )
      .refine((items) => items.length > 0 && items.every(isOrigin), {
        message: "must be comma-separated origins without path or trailing slash",
      }),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(?:ql)?:\/\//, "must start with postgres:// or postgresql://"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    SUPABASE_URL: z.string().refine((value) => isOrigin(value) && value.startsWith("https://"), {
      message: "must be an HTTPS origin without path or trailing slash",
    }),
    EMAIL_PROVIDER: z.enum(["brevo", "resend", "log"]).default("log"),
    EMAIL_FROM: z.email(),
    EMAIL_FROM_NAME: z.string().default("TODO App"),
    BREVO_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      value.DATABASE_SSL === "false" &&
      !URL.parse(value.DATABASE_URL)?.hostname.endsWith(".railway.internal")
    ) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_SSL"],
        message: "must be true in production outside the Railway private network",
      });
    }
    if (value.NODE_ENV === "production" && value.TRUST_PROXY_HOPS === undefined) {
      context.addIssue({
        code: "custom",
        path: ["TRUST_PROXY_HOPS"],
        message: "is required in production",
      });
    }
    if (value.NODE_ENV === "production" && value.EMAIL_PROVIDER === "log") {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message: "log is unavailable in production",
      });
    }
    if (value.EMAIL_PROVIDER === "brevo" && !value.BREVO_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["BREVO_API_KEY"],
        message: "is required for brevo",
      });
    }
    if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "is required for resend",
      });
    }
  });

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  database: { url: string; poolMax: number; ssl: boolean };
  supabase: { url: string; jwksUrl: string; issuer: string };
  email: {
    provider: "brevo" | "resend" | "log";
    from: string;
    fromName: string;
    brevoApiKey?: string;
    resendApiKey?: string;
  };
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
      `Invalid environment: ${result.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`).join(", ")}`,
    );
  }
  const value = result.data;
  return {
    nodeEnv: value.NODE_ENV,
    logLevel: value.LOG_LEVEL,
    database: {
      url: value.DATABASE_URL,
      poolMax: value.DATABASE_POOL_MAX,
      ssl: value.DATABASE_SSL === "true",
    },
    supabase: {
      url: value.SUPABASE_URL,
      jwksUrl: `${value.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      issuer: `${value.SUPABASE_URL}/auth/v1`,
    },
    email: {
      provider: value.EMAIL_PROVIDER,
      from: value.EMAIL_FROM,
      fromName: value.EMAIL_FROM_NAME,
      brevoApiKey: value.BREVO_API_KEY,
      resendApiKey: value.RESEND_API_KEY,
    },
    http: {
      host: value.HOST,
      port: value.PORT,
      corsOrigins: value.CORS_ORIGINS,
      trustProxyHops: value.TRUST_PROXY_HOPS ?? 0,
      rateLimit: { max: value.RATE_LIMIT_MAX, windowMs: value.RATE_LIMIT_WINDOW_MS },
    },
  };
}
