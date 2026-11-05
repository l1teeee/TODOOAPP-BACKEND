import type { EmailSender } from "../../../platform/email/email-sender.js";
import { AppError } from "../../../platform/errors/app-error.js";
import { nextStatusAfterFailure } from "../domain/email-outbox-message.js";
import type { OutboxErrorLogger, OutboxRepository } from "./ports.js";

export async function drainOutbox(deps: {
  outbox: OutboxRepository;
  email: EmailSender;
  batchSize: number;
  logger: OutboxErrorLogger;
}): Promise<{ claimed: number; sent: number; retried: number; failed: number }> {
  const messages = await deps.outbox.claim(deps.batchSize);
  const counts = { claimed: messages.length, sent: 0, retried: 0, failed: 0 };
  for (const message of messages) {
    try {
      try {
        await deps.email.send({
          to: message.toEmail,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
      } catch (error) {
        const errorCode = error instanceof AppError ? error.code : "SEND_FAILED";
        deps.logger.error({
          event: "notifications.outbox_send_failed",
          outboxId: message.id,
          errorCode,
        });
        await deps.outbox.markFailed(message, errorCode);
        if (nextStatusAfterFailure(message.attempts) === "failed") {
          counts.failed += 1;
        } else {
          counts.retried += 1;
        }
        continue;
      }
      await deps.outbox.markSent(message);
      counts.sent += 1;
    } catch (error) {
      deps.logger.error({
        event: "notifications.outbox_update_failed",
        outboxId: message.id,
        errorCode: error instanceof AppError ? error.code : "OUTBOX_UPDATE_FAILED",
      });
    }
  }
  return counts;
}
