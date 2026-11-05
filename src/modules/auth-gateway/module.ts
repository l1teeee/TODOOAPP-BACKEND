import type { AppModule, ModuleContext, ModuleFactory } from "../../platform/modules/app-module.js";
import { createAuthMailer } from "./adapters/auth-mailer.js";
import { registerAuthGatewayRoutes } from "./adapters/http/auth-gateway-routes.js";
import { createSupabaseIdentityAdmin } from "./adapters/supabase-identity-admin.js";
import { createTurnstileHumanVerifier } from "./adapters/turnstile-human-verifier.js";
import { createRegisterAccount } from "./application/register-account.js";
import { createRequestPasswordReset } from "./application/request-password-reset.js";
import { parseAuthGatewayConfig } from "./config.js";

export const createAuthGatewayModule: ModuleFactory = (context: ModuleContext): AppModule => {
  const config = parseAuthGatewayConfig(context.env);
  const humanVerifier = createTurnstileHumanVerifier(config.TURNSTILE_SECRET_KEY);
  const identityAdmin = createSupabaseIdentityAdmin({
    url: context.config.supabase.url,
    secretKey: config.SUPABASE_SECRET_KEY,
    logger: context.logger,
  });
  const mailer = createAuthMailer(context.email);
  const pending = new Set<Promise<void>>();

  function runInBackground(
    task: () => Promise<void>,
    event: "auth_gateway.register_failed" | "auth_gateway.password_reset_failed",
  ): void {
    const promise = Promise.resolve()
      .then(task)
      .catch(() => {
        context.logger.error(event);
      })
      .finally(() => {
        pending.delete(promise);
      });
    pending.add(promise);
  }

  const registerAccount = createRegisterAccount({
    humanVerifier,
    identityAdmin,
    mailer,
    runInBackground: (task) => {
      runInBackground(task, "auth_gateway.register_failed");
    },
  });
  const requestPasswordReset = createRequestPasswordReset({
    humanVerifier,
    identityAdmin,
    mailer,
    runInBackground: (task) => {
      runInBackground(task, "auth_gateway.password_reset_failed");
    },
  });

  return {
    name: "auth-gateway",
    registerRoutes(server) {
      server.addHook("onClose", async () => {
        await Promise.allSettled(pending);
      });
      registerAuthGatewayRoutes(server, { registerAccount, requestPasswordReset });
      return Promise.resolve();
    },
  };
};
