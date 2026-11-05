import { Buffer } from "node:buffer";
import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import type { createRegisterAccount } from "../../application/register-account.js";
import type { createRequestLoginCode } from "../../application/request-login-code.js";
import type { createRequestPasswordReset } from "../../application/request-password-reset.js";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const turnstileTokenSchema = z.string().min(1).max(2048);
const authRateLimit = { max: 5, timeWindow: 900_000 };
const registerSchema = z.strictObject({
  email: emailSchema,
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[a-zA-Z]/)
    .regex(/[0-9]/)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
  fullName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(
      /^[\p{L}\p{M} .'-]+$/u,
      "Use only letters, marks, spaces, apostrophes, hyphens and periods",
    )
    .transform((value) => value.replace(/\s+/g, " ")),
  turnstileToken: turnstileTokenSchema,
});
const passwordResetSchema = z.strictObject({
  email: emailSchema,
  turnstileToken: turnstileTokenSchema,
});
const loginCodeSchema = z.strictObject({ email: emailSchema });

export function registerAuthGatewayRoutes(
  server: HttpServer,
  deps: {
    registerAccount: ReturnType<typeof createRegisterAccount>;
    requestPasswordReset: ReturnType<typeof createRequestPasswordReset>;
    requestLoginCode: ReturnType<typeof createRequestLoginCode>;
  },
): void {
  server.post(
    "/auth/register",
    {
      config: { rateLimit: authRateLimit },
      schema: {
        tags: ["auth"],
        body: registerSchema,
        response: { 202: z.object({ status: z.literal("verification_sent") }) },
      },
    },
    async (request, reply) => {
      await deps.registerAccount({ ...request.body, remoteIp: request.ip });
      return reply.status(202).send({ status: "verification_sent" });
    },
  );

  server.post(
    "/auth/password-reset",
    {
      config: { rateLimit: authRateLimit },
      schema: {
        tags: ["auth"],
        body: passwordResetSchema,
        response: { 202: z.object({ status: z.literal("reset_sent") }) },
      },
    },
    async (request, reply) => {
      await deps.requestPasswordReset({ ...request.body, remoteIp: request.ip });
      return reply.status(202).send({ status: "reset_sent" });
    },
  );

  server.post(
    "/auth/login-code",
    {
      config: { rateLimit: authRateLimit },
      schema: {
        tags: ["auth"],
        body: loginCodeSchema,
        response: { 202: z.object({ status: z.literal("code_sent") }) },
      },
    },
    async (request, reply) => {
      deps.requestLoginCode(request.body);
      return reply.status(202).send({ status: "code_sent" });
    },
  );
}
