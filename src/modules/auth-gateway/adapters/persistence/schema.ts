import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authEmailCooldowns = pgTable("auth_email_cooldowns", {
  emailHash: text("email_hash").primaryKey(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull(),
});
