import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      /^(?:1x0000|2x0000|3x0000)/.test(value.TURNSTILE_SECRET_KEY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["TURNSTILE_SECRET_KEY"],
        message: "Cloudflare test secrets are unavailable in production",
      });
    }
  });

export function parseAuthGatewayConfig(env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const keys = result.error.issues.map((issue) => String(issue.path[0]));
    throw new Error(`Invalid auth-gateway environment: ${keys.join(", ")}`);
  }
  return result.data;
}
