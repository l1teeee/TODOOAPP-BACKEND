import { context, trace } from "@opentelemetry/api";
import { getRPCMetadata, RPCType } from "@opentelemetry/core";
import * as Sentry from "@sentry/node";
import type { HttpServer } from "../http/http-server.js";

export function registerRequestTelemetry(server: HttpServer): void {
  server.addHook("onRequest", (request, _reply, done) => {
    const metadata = getRPCMetadata(context.active());
    if (metadata?.type === RPCType.HTTP && request.routeOptions.url !== undefined) {
      metadata.route = request.routeOptions.url;
    }
    done();
  });
  server.addHook("preHandler", (request, _reply, done) => {
    if (request.user) {
      Sentry.setUser({ id: request.user.id });
      trace.getActiveSpan()?.setAttribute("enduser.id", request.user.id);
    }
    done();
  });
}
