import { isAuthError } from "@supabase/supabase-js";
import { AppError } from "../../platform/errors/app-error.js";
import type { AppModule, ModuleContext, ModuleFactory } from "../../platform/modules/app-module.js";
import { createAuthMailer } from "./adapters/auth-mailer.js";
import { registerAuthGatewayRoutes } from "./adapters/http/auth-gateway-routes.js";
import { createDrizzleEmailCooldown } from "./adapters/persistence/drizzle-email-cooldown.js";
import { createSupabaseIdentityAdmin } from "./adapters/supabase-identity-admin.js";
import { createTurnstileHumanVerifier } from "./adapters/turnstile-human-verifier.js";
import type { BackgroundRunner } from "./application/ports.js";
import { createRegisterAccount } from "./application/register-account.js";
import { createRequestLoginCode } from "./application/request-login-code.js";
import { createRequestPasswordReset } from "./application/request-password-reset.js";
import { parseAuthGatewayConfig } from "./config.js";

export const createAuthGatewayModule: ModuleFactory = (context: ModuleContext): AppModule => {
  const config = parseAuthGatewayConfig(context.env);
  const humanVerifier = createTurnstileHumanVerifier(config.TURNSTILE_SECRET_KEY);
  const identityAdmin = createSupabaseIdentityAdmin({
    url: context.config.supabase.url,
    secretKey: config.SUPABASE_SECRET_KEY,
    db: context.db,
  });
  const mailer = createAuthMailer(context.email);
  const emailCooldown = createDrizzleEmailCooldown(context.db);
  const pending = new Set<Promise<void>>();

  function makeBackgroundRunner(
    event:
      | "auth_gateway.register_failed"
      | "auth_gateway.password_reset_failed"
      | "auth_gateway.login_code_failed",
  ): BackgroundRunner {
    return (task) => {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new AppError("unavailable", "AUTH_GATEWAY_TIMEOUT", "Background task timed out"));
        }, 15_000);
      });
      const promise = Promise.race([Promise.resolve().then(task), timeout])
        .catch((error: unknown) => {
          const cause = error instanceof AppError ? error.cause : error;
          let errorCode: string | number = "AUTH_GATEWAY_FAILED";
          if (error instanceof AppError) {
            errorCode = error.code;
          }
          if (isAuthError(cause)) {
            errorCode = cause.code ?? cause.status ?? errorCode;
          }
          context.logger.error({ event, errorCode });
        })
        .finally(() => {
          clearTimeout(timer);
          pending.delete(promise);
        });
      pending.add(promise);
    };
  }

  const registerAccount = createRegisterAccount({
    humanVerifier,
    identityAdmin,
    mailer,
    emailCooldown,
    runInBackground: makeBackgroundRunner("auth_gateway.register_failed"),
  });
  const requestPasswordReset = createRequestPasswordReset({
    humanVerifier,
    identityAdmin,
    mailer,
    emailCooldown,
    runInBackground: makeBackgroundRunner("auth_gateway.password_reset_failed"),
  });
  const requestLoginCode = createRequestLoginCode({
    identityAdmin,
    mailer,
    emailCooldown,
    runInBackground: makeBackgroundRunner("auth_gateway.login_code_failed"),
  });

  return {
    name: "auth-gateway",
    registerRoutes(server) {
      server.addHook("onClose", async () => {
        await Promise.allSettled(pending);
      });
      registerAuthGatewayRoutes(server, {
        registerAccount,
        requestPasswordReset,
        requestLoginCode,
      });
      return Promise.resolve();
    },
  };
};
