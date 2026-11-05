import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().refine((value) => {
    const url = URL.parse(value);
    return (
      url?.origin === value &&
      (url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost"))
    );
  }, "Expected an HTTPS origin or http://localhost origin without a trailing slash"),
  REMINDER_LEAD_MINUTES: z.coerce.number().int().min(0).max(1440).default(15),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
});

export function loadNotificationsConfig(env: NodeJS.ProcessEnv) {
  return schema.parse(env);
}
