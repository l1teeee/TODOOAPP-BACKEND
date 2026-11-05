import { renderEmail } from "../../../platform/email/email-layout.js";
import type { EmailMessage } from "../../../platform/email/email-sender.js";

export function signupCodeEmail(input: {
  to: string;
  fullName: string;
  code: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: "Your TODO App verification code",
    ...renderEmail({
      preheader: "Confirm your email with your TODO App verification code.",
      title: "Confirm your email",
      intro: `Hello ${input.fullName}, enter this code in the app to confirm your email.`,
      code: input.code,
      outro:
        "This code expires in 60 minutes. If you did not create an account, ignore this email.",
    }),
  };
}

export function accountExistsEmail(input: { to: string }): EmailMessage {
  return {
    to: input.to,
    subject: "You already have a TODO App account",
    ...renderEmail({
      preheader: "Log in to your existing TODO App account.",
      title: "You already have an account",
      intro:
        'Someone tried to register with this email, but you already have a TODO App account. Log in or use "Forgot password" to set a new password, which also confirms your email.',
    }),
  };
}

export function recoveryCodeEmail(input: { to: string; code: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Your TODO App password reset code",
    ...renderEmail({
      preheader: "Reset your TODO App password with this code.",
      title: "Reset your password",
      intro: "Enter this code in the app to reset your password.",
      code: input.code,
      outro:
        "This code expires in 60 minutes. If you did not request a password reset, ignore this email.",
    }),
  };
}

export function loginCodeEmail(input: { to: string; code: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Your TODO App login code",
    ...renderEmail({
      preheader: "Log in to TODO App with this code.",
      title: "Your login code",
      intro: "Enter this code in the app to log in.",
      code: input.code,
      outro: "This code expires in 60 minutes. If you did not try to log in, ignore this email.",
    }),
  };
}
