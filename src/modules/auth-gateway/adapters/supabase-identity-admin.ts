import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import type { DbExecutor } from "../../../platform/db/database.js";
import { profiles } from "../../../platform/identity/adapters/persistence/schema.js";
import type { IdentityAdmin } from "../application/ports.js";
import { identityUnavailable } from "../domain/auth-gateway-errors.js";

export function createSupabaseIdentityAdmin(options: {
  url: string;
  secretKey: string;
  db: DbExecutor;
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
        throw identityUnavailable(error);
      }
      return { status: "created", code: data.properties.email_otp };
    },
    async createRecoveryCode(email) {
      const { data, error } = await client.auth.admin.generateLink({ type: "recovery", email });
      if (error) {
        if (error.code === "user_not_found" || error.status === 404) {
          return { status: "unknown_email" };
        }
        throw identityUnavailable(error);
      }
      return { status: "created", code: data.properties.email_otp };
    },
    async createLoginCode(email) {
      const [profile] = await options.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(sql`lower(${profiles.email}) = lower(${email})`)
        .limit(1);
      if (!profile) {
        return { status: "unknown_email" };
      }
      const { data, error } = await client.auth.admin.generateLink({ type: "magiclink", email });
      if (error) {
        if (error.code === "user_not_found" || error.status === 404) {
          return { status: "unknown_email" };
        }
        throw identityUnavailable(error);
      }
      return { status: "created", code: data.properties.email_otp };
    },
  };
}
