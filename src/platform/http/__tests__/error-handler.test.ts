import { describe, it, expect, afterAll } from "@jest/globals";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { AppError, type AppErrorKind } from "../../errors/app-error.js";
import { registerErrorHandling } from "../error-handler.js";

describe("HTTP error handler", () => {
  const server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(server);
  server.get("/app/:kind", (request) => {
    throw new AppError(
      (request.params as { kind: AppErrorKind }).kind,
      "TEST_CODE",
      "Test message",
    );
  });
  server.post(
    "/validation",
    { schema: { body: z.object({ name: z.string().min(2) }) } },
    () => "ok",
  );
  server.get("/internal", () => {
    throw new Error("secret detail");
  });
  server.get("/rate", () => {
    throw Object.assign(new Error("private"), { statusCode: 429, code: "RATE_LIMITED" });
  });
  afterAll(() => server.close());
  it.each([
    ["invalid", 400],
    ["unauthorized", 401],
    ["forbidden", 403],
    ["not_found", 404],
    ["conflict", 409],
    ["unavailable", 503],
  ] as const)("maps %s to %i", async (kind, status) => {
    const response = await server.inject({ method: "GET", url: `/app/${kind}` });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ error: { code: "TEST_CODE", message: "Test message" } });
  });
  it("reports validation details", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/validation",
      payload: { name: "x" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        details: [{ path: "/name", message: expect.any(String) }],
      },
    });
  });
  it("hides internal error details", async () => {
    const response = await server.inject({ method: "GET", url: "/internal" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
    expect(response.body).not.toContain("secret detail");
  });
  it("maps rate limits and unknown routes", async () => {
    const rate = await server.inject({ method: "GET", url: "/rate" });
    expect(rate.statusCode).toBe(429);
    expect(rate.json()).toEqual({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
    const missing = await server.inject({ method: "GET", url: "/missing" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "ROUTE_NOT_FOUND" } });
  });
});
