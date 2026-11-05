import { z } from "zod";

const schema = z.object({
  TURNSTILE_SECRET_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function parseAuthGatewayConfig(env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const keys = result.error.issues.map((issue) => String(issue.path[0]));
    throw new Error(`Invalid auth-gateway environment: ${keys.join(", ")}`);
  }
  return result.data;
}
