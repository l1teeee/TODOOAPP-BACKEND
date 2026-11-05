import { createClient } from "@supabase/supabase-js";
import type { ModuleContext } from "../../../platform/modules/app-module.js";
import type { IdentityAdmin } from "../application/ports.js";
import { identityUnavailable } from "../domain/auth-gateway-errors.js";

export function createSupabaseIdentityAdmin(options: {
  url: string;
  secretKey: string;
  logger: ModuleContext["logger"];
}): IdentityAdmin {
  const client = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    async createSignupCode(input) {
      const { data, error } = await client.auth.admin.generateLink({
        type: "signup",
        email: input.email,
        password: input.password,
        options: { data: { full_name: input.fullName } },
      });
      if (error) {
        if (
          error.code === "email_exists" ||
          error.code === "user_already_exists" ||
          (error.status === 422 && error.message.includes("already been registered"))
        ) {
          return { status: "already_registered" };
        }
        options.logger.error({ status: error.status, code: error.code });
        throw identityUnavailable();
      }
      return { status: "created", code: data.properties.email_otp };
    },
    async createRecoveryCode(email) {
      const { data, error } = await client.auth.admin.generateLink({ type: "recovery", email });
      if (error) {
        if (error.code === "user_not_found" || error.status === 404) {
          return { status: "unknown_email" };
        }
        options.logger.error({ status: error.status, code: error.code });
        throw identityUnavailable();
      }
      return { status: "created", code: data.properties.email_otp };
    },
  };
}
