import type { FastifyBaseLogger } from "fastify";
import type { EmailSender } from "./email-sender.js";

export function createLogEmailSender(logger: FastifyBaseLogger): EmailSender {
  return {
    send(message) {
      // Local development reads verification codes from the full email text in the log.
      logger.info({ to: message.to, subject: message.subject, text: message.text }, "Email sent");
      return Promise.resolve();
    },
  };
}
