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
