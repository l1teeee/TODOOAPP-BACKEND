import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import type { createRegisterAccount } from "../../application/register-account.js";
import type { createRequestPasswordReset } from "../../application/request-password-reset.js";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const turnstileTokenSchema = z.string().min(1).max(2048);
const registerSchema = z.strictObject({
  email: emailSchema,
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[a-zA-Z]/)
    .regex(/[0-9]/),
  fullName: z.string().trim().min(1).max(80),
  turnstileToken: turnstileTokenSchema,
});
const passwordResetSchema = z.strictObject({
  email: emailSchema,
  turnstileToken: turnstileTokenSchema,
});

export function registerAuthGatewayRoutes(
  server: HttpServer,
  deps: {
    registerAccount: ReturnType<typeof createRegisterAccount>;
    requestPasswordReset: ReturnType<typeof createRequestPasswordReset>;
  },
): void {
  server.post(
    "/auth/register",
    {
      config: { rateLimit: { max: 5, timeWindow: 900_000 } },
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
      config: { rateLimit: { max: 5, timeWindow: 900_000 } },
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
}
