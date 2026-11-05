export const MAX_ATTEMPTS = 5;
export const SENDING_LOCK_TIMEOUT_MINUTES = 5;

export function nextAttemptDelayMinutes(attempts: number): number {
  return 2 ** attempts;
}

export function nextStatusAfterFailure(attempts: number): "failed" | "pending" {
  return attempts >= MAX_ATTEMPTS ? "failed" : "pending";
}

export interface NewEmailOutboxMessage {
  userId: string;
  kind: string;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailOutboxMessage extends NewEmailOutboxMessage {
  id: string;
  attempts: number;
}
