import { AppError } from "../errors/app-error.js";
import type { EmailSender } from "./email-sender.js";

export function createBrevoEmailSender(options: {
  apiKey: string;
  from: string;
  fromName: string;
}): EmailSender {
  return {
    async send(message) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": options.apiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          sender: { name: options.fromName, email: options.from },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
      });
      if (!response.ok) {
        throw new AppError("unavailable", "EMAIL_SEND_FAILED", "Email delivery failed");
      }
    },
  };
}
