import type { NotificationEmailTemplates, OutboxRepository, SubtasksCreated } from "./ports.js";

export async function enqueueSubtaskEmail(
  deps: { outbox: OutboxRepository; templates: NotificationEmailTemplates },
  input: SubtasksCreated,
): Promise<void> {
  const profile = await deps.outbox.findProfile(input.userId);
  if (!profile?.emailNotifications) {
    return;
  }
  const message = deps.templates.subtaskCreated({
    ...input,
    to: profile.email,
    displayName: profile.displayName,
  });
  await deps.outbox.enqueue({
    userId: input.userId,
    kind: "subtask_created",
    toEmail: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
