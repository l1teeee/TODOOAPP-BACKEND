import type { EmailMessage } from "../../../platform/email/email-sender.js";
import type { EmailOutboxMessage, NewEmailOutboxMessage } from "../domain/email-outbox-message.js";

export interface NotificationProfile {
  email: string;
  displayName: string | null;
  emailNotifications: boolean;
}

export interface SubtasksCreated {
  userId: string;
  activityId: string;
  activityTitle: string;
  subtaskTitles: readonly string[];
}

export interface DueReminder {
  userId: string;
  activityId: string;
  title: string;
  to: string;
  scheduledDate: string;
  startTime: string;
  location: string | null;
}

export interface NotificationEmailTemplates {
  subtaskCreated(input: SubtasksCreated & { to: string; displayName: string | null }): EmailMessage;
  reminderDue(input: DueReminder): EmailMessage;
}

export interface OutboxErrorLogger {
  error(fields: { event: string; outboxId: string; errorCode: string }): void;
}

export interface OutboxRepository {
  findProfile(userId: string): Promise<NotificationProfile | null>;
  enqueue(message: NewEmailOutboxMessage): Promise<void>;
  claim(batchSize: number): Promise<EmailOutboxMessage[]>;
  markSent(message: EmailOutboxMessage): Promise<void>;
  markFailed(message: EmailOutboxMessage, errorCode: string): Promise<void>;
  cleanup(): Promise<void>;
}

export interface ReminderRepository {
  enqueueDue(
    leadMinutes: number,
    render: NotificationEmailTemplates["reminderDue"],
  ): Promise<number>;
}
