import { z } from "zod";

const schema = z.object({
  DEEPINFRA_API_KEY: z.string().trim().min(1),
  DEEPINFRA_MODEL: z.string().default("deepseek-ai/DeepSeek-V4-Flash-0731"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
});

export function isAiAssistantEnabled(env: NodeJS.ProcessEnv): boolean {
  return typeof env.DEEPINFRA_API_KEY === "string" && env.DEEPINFRA_API_KEY.trim().length > 0;
}

export function loadAiAssistantConfig(env: NodeJS.ProcessEnv) {
  return schema.parse(env);
}
