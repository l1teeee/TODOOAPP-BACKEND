import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import * as Sentry from "@sentry/node";
import {
  redactSensitiveText,
  redactStringsDeep,
  removeParams,
} from "../logging/redact-sensitive-text.js";
import { loadObservabilityConfig } from "./observability-config.js";
import type { ObservabilityConfig, ServiceName } from "./observability-config.js";

let sdk: NodeSDK | undefined;

function scrubFields(value: unknown, depth: number): void {
  if (depth > 5 || value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (
      /^(email|password|token|access_token|refresh_token|authorization|cookie|secret|api_?key)$/i.test(
        key,
      )
    ) {
      Object.assign(value, { [key]: "[Filtered]" });
    } else {
      scrubFields(entry, depth + 1);
    }
  }
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).filter(
          ([key]) => !["authorization", "cookie"].includes(key.toLowerCase()),
        ),
      );
    }
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  scrubFields(event.extra, 1);
  scrubFields(event.contexts, 1);
  if (event.message !== undefined) event.message = redactSensitiveText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value !== undefined) exception.value = redactSensitiveText(exception.value);
  }
  event.extra = redactStringsDeep(removeParams(event.extra)) as typeof event.extra;
  event.contexts = redactStringsDeep(removeParams(event.contexts)) as typeof event.contexts;
  return event;
}

function normalizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  scrubEvent(event);
  const exceptions = event.exception?.values ?? [];
  let messageCapture = false;
  // Synthetic SDK stacks obscure message titles and group unrelated logs.
  for (const exception of exceptions) {
    if (exception.mechanism?.type === "auto.log.pino" && !exception.type) {
      if (!event.message && exception.value) event.message = exception.value;
      messageCapture = true;
      delete event.exception;
      break;
    }
    exception.type ??= "LoggedError";
  }
  if (!event.message && (event.exception?.values?.length ?? 0) === 0) {
    const pino = event.contexts?.pino;
    if (typeof pino?.event === "string" && pino.event) {
      event.message = pino.event;
    } else if (typeof pino?.errorCode === "string" && pino.errorCode) {
      event.message = pino.errorCode;
    } else {
      event.message = "Unnamed error log";
    }
  }
  if (messageCapture || ((event.exception?.values?.length ?? 0) === 0 && event.logger === "pino")) {
    event.fingerprint = ["pino-log", event.message ?? "Unnamed error log"];
  }
  return event;
}

export function startTelemetry(serviceName: ServiceName): void {
  const config = loadObservabilityConfig(process.env, serviceName);
  startOpenTelemetry(config);
  startSentry(config);
}

function startOpenTelemetry(config: ObservabilityConfig): void {
  if (config.otlpEnabled) {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_NAMESPACE]: "todo-app",
        [ATTR_SERVICE_VERSION]: config.release ?? "unknown",
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment,
      }),
      traceExporter: new OTLPTraceExporter(),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
          exportIntervalMillis: 60_000,
        }),
      ],
      logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) =>
            request.url === "/health" || !!request.url?.startsWith("/health/"),
        }),
        new UndiciInstrumentation(),
        new PgInstrumentation({ requireParentSpan: true }),
        new PinoInstrumentation(),
        new RuntimeNodeInstrumentation(),
      ],
    });
    sdk.start();
  }
}

function startSentry(config: ObservabilityConfig): void {
  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment,
      release: config.release,
      initialScope: { tags: { service: config.serviceName } },
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
      // Pino records attach logged fields to events beyond automatic data collection.
      beforeSend: normalizeEvent,
      // Record every occurrence and user; a rate limit on the Sentry key protects the quota.
      integrations: (defaults) => [
        ...defaults.filter((integration) => integration.name !== "Dedupe"),
        Sentry.openTelemetryIntegration(),
        Sentry.fastifyIntegration({ shouldHandleError: () => false }),
        Sentry.pinoIntegration({ log: { levels: [] }, error: { levels: ["error", "fatal"] } }),
      ],
    });
  }
}

export async function shutdownTelemetry(): Promise<void> {
  const results = await Promise.allSettled([...(sdk ? [sdk.shutdown()] : []), Sentry.close(2000)]);
  const reasons: unknown[] = [];
  for (const result of results) {
    if (result.status === "rejected") reasons.push(result.reason);
  }
  if (reasons.length) throw new AggregateError(reasons, "Telemetry shutdown failed");
}
