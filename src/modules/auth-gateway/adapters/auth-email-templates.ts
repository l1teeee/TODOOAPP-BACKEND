import type { EmailMessage } from "../../../platform/email/email-sender.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function emailLayout(content: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#171717;line-height:1.5">${content}</div>`;
}

function codeBlock(code: string): string {
  return `<div style="font-family:monospace;font-size:32px;letter-spacing:6px;text-align:center;padding:20px;background:#f3f4f6;border-radius:8px">${escapeHtml(code)}</div>`;
}

export function signupCodeEmail(input: {
  to: string;
  fullName: string;
  code: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: "Your TODO App verification code",
    html: emailLayout(
      `<p>Hello ${escapeHtml(input.fullName)},</p>${codeBlock(input.code)}<p>Enter this code in the app to confirm your email. It expires in 60 minutes.</p><p>If you did not create an account, ignore this email.</p>`,
    ),
    text: `Hello ${input.fullName},\n\n${input.code}\n\nEnter this code in the app to confirm your email. It expires in 60 minutes.\n\nIf you did not create an account, ignore this email.`,
  };
}

export function accountExistsEmail(input: { to: string }): EmailMessage {
  const text =
    'Someone tried to register with this email, but you already have a TODO App account. Log in or use "Forgot password" to reset your password.';
  return {
    to: input.to,
    subject: "You already have a TODO App account",
    html: emailLayout(`<p>${escapeHtml(text)}</p>`),
    text,
  };
}

export function recoveryCodeEmail(input: { to: string; code: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Your TODO App password reset code",
    html: emailLayout(
      `${codeBlock(input.code)}<p>Enter this code in the app to reset your password. It expires in 60 minutes.</p><p>If you did not request a password reset, ignore this email.</p>`,
    ),
    text: `${input.code}\n\nEnter this code in the app to reset your password. It expires in 60 minutes.\n\nIf you did not request a password reset, ignore this email.`,
  };
}
