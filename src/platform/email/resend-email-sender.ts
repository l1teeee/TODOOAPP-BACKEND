import { AppError } from "../errors/app-error.js";
import type { EmailSender } from "./email-sender.js";

export function createResendEmailSender(options: {
  apiKey: string;
  from: string;
  fromName: string;
}): EmailSender {
  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          from: `${options.fromName} <${options.from}>`,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!response.ok) {
        throw new AppError("unavailable", "EMAIL_SEND_FAILED", "Email delivery failed");
      }
    },
  };
}
