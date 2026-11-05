import type { EmailSender } from "../../../platform/email/email-sender.js";
import { AppError } from "../../../platform/errors/app-error.js";
import type { OutboxRepository } from "./ports.js";

export async function drainOutbox(deps: {
  outbox: OutboxRepository;
  email: EmailSender;
  batchSize: number;
}): Promise<{ claimed: number; sent: number; retried: number; failed: number }> {
  const messages = await deps.outbox.claim(deps.batchSize);
  const counts = { claimed: messages.length, sent: 0, retried: 0, failed: 0 };
  for (const message of messages) {
    try {
      await deps.email.send({
        to: message.toEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      await deps.outbox.markFailed(message, error instanceof AppError ? error.code : "SEND_FAILED");
      if (message.attempts >= 5) {
        counts.failed += 1;
      } else {
        counts.retried += 1;
      }
      continue;
    }
    await deps.outbox.markSent(message);
    counts.sent += 1;
  }
  return counts;
}
