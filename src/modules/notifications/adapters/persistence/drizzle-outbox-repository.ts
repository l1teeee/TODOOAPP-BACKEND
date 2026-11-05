import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import type { OutboxRepository } from "../../application/ports.js";
import { emailOutbox } from "./schema.js";

export function createDrizzleOutboxRepository(db: DbExecutor): OutboxRepository {
  return {
    async findProfile(userId) {
      const [profile] = await db
        .select({
          email: profiles.email,
          displayName: profiles.displayName,
          emailNotifications: profiles.emailNotifications,
        })
        .from(profiles)
        .where(eq(profiles.id, userId));
      return profile ?? null;
    },
    async enqueue(message) {
      await db.insert(emailOutbox).values(message);
    },
    claim(batchSize) {
      const due = db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(
          sql`(${emailOutbox.status} = 'pending' and ${emailOutbox.nextAttemptAt} <= now())
          or (${emailOutbox.status} = 'sending' and ${emailOutbox.lockedAt} < now() - interval '5 minutes')`,
        )
        .orderBy(emailOutbox.createdAt)
        .limit(batchSize)
        .for("update", { skipLocked: true });
      return db
        .update(emailOutbox)
        .set({
          status: "sending",
          lockedAt: sql`now()`,
          attempts: sql`${emailOutbox.attempts} + 1`,
        })
        .where(inArray(emailOutbox.id, due))
        .returning();
    },
    async markSent(message) {
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: sql`now()`, lockedAt: null, lastError: null })
        .where(
          and(
            eq(emailOutbox.id, message.id),
            eq(emailOutbox.userId, message.userId),
            eq(emailOutbox.status, "sending"),
            eq(emailOutbox.attempts, message.attempts),
          ),
        );
    },
    async markFailed(message, errorCode) {
      await db
        .update(emailOutbox)
        .set({
          status: message.attempts >= 5 ? "failed" : "pending",
          nextAttemptAt: sql`now() + ${2 ** message.attempts} * interval '1 minute'`,
          lockedAt: null,
          lastError: errorCode,
        })
        .where(
          and(
            eq(emailOutbox.id, message.id),
            eq(emailOutbox.userId, message.userId),
            eq(emailOutbox.status, "sending"),
            eq(emailOutbox.attempts, message.attempts),
          ),
        );
    },
  };
}
