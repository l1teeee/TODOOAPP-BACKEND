import type { NotificationEmailTemplates, ReminderRepository } from "./ports.js";

export function scanDueReminders(deps: {
  reminders: ReminderRepository;
  templates: NotificationEmailTemplates;
  leadMinutes: number;
}): Promise<number> {
  return deps.reminders.enqueueDue(deps.leadMinutes, (reminder) =>
    deps.templates.reminderDue(reminder),
  );
}
