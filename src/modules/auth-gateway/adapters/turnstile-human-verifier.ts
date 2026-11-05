import { z } from "zod";
import type { HumanVerifier } from "../application/ports.js";
import { captchaUnavailable } from "../domain/auth-gateway-errors.js";

const responseSchema = z.object({ success: z.boolean() });

export function createTurnstileHumanVerifier(secret: string): HumanVerifier {
  return {
    async verify(input) {
      try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret,
            response: input.token,
            remoteip: input.remoteIp,
          }),
          signal: AbortSignal.timeout(5_000),
        });
        if (response.ok) {
          const json = responseSchema.parse(await response.json());
          return json.success;
        }
      } catch {
        throw captchaUnavailable();
      }
      throw captchaUnavailable();
    },
  };
}
