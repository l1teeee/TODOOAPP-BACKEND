import type { FastifyBaseLogger } from "fastify";
import type { EmailSender } from "./email-sender.js";

export function createLogEmailSender(logger: FastifyBaseLogger): EmailSender {
  return {
    send(message) {
      logger.info({ to: message.to, subject: message.subject, text: message.text }, "Email sent");
      return Promise.resolve();
    },
  };
}
