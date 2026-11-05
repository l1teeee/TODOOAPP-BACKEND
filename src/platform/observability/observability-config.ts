import { z } from "zod";

export type ServiceName = "todo-api" | "todo-worker";

export interface ObservabilityConfig {
  serviceName: ServiceName;
  environment: string;
  release: string | undefined;
  sentryDsn: string | undefined;
  otlpEnabled: boolean;
}

const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const url = (protocols: string[]) =>
  optional.refine((value) => {
    if (value === undefined) return true;
    try {
      return protocols.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  });

export function loadObservabilityConfig(
  env: NodeJS.ProcessEnv,
  serviceName: ServiceName,
): ObservabilityConfig {
  const schema = z
    .object({
      SENTRY_DSN: url(["https:"]),
      SENTRY_ENVIRONMENT: optional,
      SENTRY_RELEASE: optional,
      OTEL_EXPORTER_OTLP_ENDPOINT: url(["http:", "https:"]),
      OTEL_EXPORTER_OTLP_HEADERS: optional,
      NODE_ENV: optional,
      RAILWAY_GIT_COMMIT_SHA: optional,
      npm_package_version: optional,
    })
    .refine((value) => !value.OTEL_EXPORTER_OTLP_ENDPOINT || !!value.OTEL_EXPORTER_OTLP_HEADERS, {
      path: ["OTEL_EXPORTER_OTLP_HEADERS"],
      message: "required when OTEL_EXPORTER_OTLP_ENDPOINT is set",
    });
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
    throw new Error(`Invalid observability environment: ${issues.join(", ")}`);
  }
  return {
    serviceName,
    environment: result.data.SENTRY_ENVIRONMENT ?? result.data.NODE_ENV ?? "development",
    release:
      result.data.SENTRY_RELEASE ??
      result.data.RAILWAY_GIT_COMMIT_SHA ??
      result.data.npm_package_version,
    sentryDsn: result.data.SENTRY_DSN,
    otlpEnabled: !!result.data.OTEL_EXPORTER_OTLP_ENDPOINT,
  };
}
