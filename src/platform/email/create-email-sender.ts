import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../config/env.js";
import { createBrevoEmailSender } from "./brevo-email-sender.js";
import type { EmailSender } from "./email-sender.js";
import { createLogEmailSender } from "./log-email-sender.js";
import { createResendEmailSender } from "./resend-email-sender.js";

export function createEmailSender(config: AppConfig, logger: FastifyBaseLogger): EmailSender {
  const email = config.email;
  switch (email.provider) {
    case "brevo": {
      if (!email.brevoApiKey) {
        throw new Error("BREVO_API_KEY is required for brevo");
      }
      return createBrevoEmailSender({ ...email, apiKey: email.brevoApiKey });
    }
    case "resend": {
      if (!email.resendApiKey) {
        throw new Error("RESEND_API_KEY is required for resend");
      }
      return createResendEmailSender({ ...email, apiKey: email.resendApiKey });
    }
    case "log":
      return createLogEmailSender(logger);
  }
}
