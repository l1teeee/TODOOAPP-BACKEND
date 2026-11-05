import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppConfig } from "../../config/env.js";
import { invalidToken } from "../application/identity-errors.js";
import type { AccessTokenVerifier } from "../application/ports.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSupabaseJwtVerifier(config: AppConfig["supabase"]): AccessTokenVerifier {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: config.issuer,
          audience: "authenticated",
          algorithms: ["ES256", "RS256"],
        });
        if (
          !payload.sub ||
          !uuidPattern.test(payload.sub) ||
          typeof payload.email !== "string" ||
          !payload.email
        ) {
          throw invalidToken();
        }
        const metadata: unknown = payload.user_metadata;
        const fullName =
          typeof metadata === "object" &&
          metadata !== null &&
          "full_name" in metadata &&
          typeof metadata.full_name === "string"
            ? metadata.full_name
            : null;
        return { id: payload.sub, email: payload.email, fullName };
      } catch {
        throw invalidToken();
      }
    },
  };
}
