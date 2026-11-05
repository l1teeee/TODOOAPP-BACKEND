import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import type { OutboxRepository } from "../../application/ports.js";
import {
  MAX_ATTEMPTS,
  SENDING_LOCK_TIMEOUT_MINUTES,
  nextAttemptDelayMinutes,
  nextStatusAfterFailure,
} from "../../domain/email-outbox-message.js";
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
    async claim(batchSize) {
      const stuck = sql`${emailOutbox.lockedAt} < now() - ${SENDING_LOCK_TIMEOUT_MINUTES} * interval '1 minute'`;
      await db
        .update(emailOutbox)
        .set({ status: "failed", lockedAt: null, lastError: "STUCK_SENDING" })
        .where(
          and(eq(emailOutbox.status, "sending"), stuck, gte(emailOutbox.attempts, MAX_ATTEMPTS)),
        );
      await db
        .update(emailOutbox)
        .set({ status: "failed", lockedAt: null, lastError: "NOTIFICATIONS_OFF" })
        .where(
          and(
            or(eq(emailOutbox.status, "pending"), and(eq(emailOutbox.status, "sending"), stuck)),
            inArray(
              emailOutbox.userId,
              db
                .select({ id: profiles.id })
                .from(profiles)
                .where(eq(profiles.emailNotifications, false)),
            ),
          ),
        );
      const due = db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .innerJoin(profiles, eq(profiles.id, emailOutbox.userId))
        .where(
          and(
            eq(profiles.emailNotifications, true),
            sql`((${emailOutbox.status} = 'pending' and ${emailOutbox.nextAttemptAt} <= now())
              or (${emailOutbox.status} = 'sending' and ${stuck} and ${emailOutbox.attempts} < ${MAX_ATTEMPTS}))`,
          ),
        )
        .orderBy(emailOutbox.createdAt)
        .limit(batchSize)
        .for("update", { of: emailOutbox, skipLocked: true });
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
          status: nextStatusAfterFailure(message.attempts),
          nextAttemptAt: sql`now() + ${nextAttemptDelayMinutes(message.attempts)} * interval '1 minute'`,
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
    async cleanup() {
      await db
        .delete(emailOutbox)
        .where(
          and(
            inArray(emailOutbox.status, ["sent", "failed"]),
            sql`${emailOutbox.createdAt} < now() - interval '30 days'`,
          ),
        );
    },
  };
}
