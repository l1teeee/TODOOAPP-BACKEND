import { createClient } from "@supabase/supabase-js";
import type { IdentityAdmin, RecoveryCodeResult } from "../application/ports.js";
import { identityUnavailable } from "../domain/auth-gateway-errors.js";

export function createSupabaseIdentityAdmin(options: {
  url: string;
  secretKey: string;
}): IdentityAdmin {
  const client = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  async function generateCode(
    type: "magiclink" | "recovery",
    email: string,
  ): Promise<RecoveryCodeResult> {
    const { data, error } = await client.auth.admin.generateLink({ type, email });
    if (error) {
      if (error.code === "user_not_found") {
        return { status: "unknown_email" };
      }
      throw identityUnavailable(error);
    }
    return { status: "created", code: data.properties.email_otp };
  }

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
        throw identityUnavailable(error);
      }
      return { status: "created", code: data.properties.email_otp };
    },
    createRecoveryCode: (email) => generateCode("recovery", email),
    async createLoginCode({ userId, email }) {
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error) {
        if (error.code === "user_not_found") {
          return { status: "unknown_email" };
        }
        throw identityUnavailable(error);
      }
      if (data.user.email !== email || !data.user.email_confirmed_at) {
        return { status: "unknown_email" };
      }
      return generateCode("magiclink", email);
    },
  };
}
