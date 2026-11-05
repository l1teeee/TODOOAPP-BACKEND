import type { EmailSender } from "../../../platform/email/email-sender.js";
import type { AuthMailer } from "../application/ports.js";
import { accountExistsEmail, recoveryCodeEmail, signupCodeEmail } from "./auth-email-templates.js";

export function createAuthMailer(email: EmailSender): AuthMailer {
  return {
    sendSignupCode: (input) => email.send(signupCodeEmail(input)),
    sendAccountExists: (input) => email.send(accountExistsEmail(input)),
    sendRecoveryCode: (input) => email.send(recoveryCodeEmail(input)),
  };
}
