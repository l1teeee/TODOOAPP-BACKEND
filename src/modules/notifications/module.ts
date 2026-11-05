import { z } from "zod";
import { AppError } from "../../platform/errors/app-error.js";
import type { AppModule, ModuleContext } from "../../platform/modules/app-module.js";
import { createNotificationEmailTemplates } from "./adapters/notification-email-templates.js";
import { createDrizzleOutboxRepository } from "./adapters/persistence/drizzle-outbox-repository.js";
import { createDrizzleReminderRepository } from "./adapters/persistence/drizzle-reminder-repository.js";
import { drainOutbox } from "./application/drain-outbox.js";
import { enqueueSubtaskEmail } from "./application/enqueue-subtask-email.js";
import { scanDueReminders } from "./application/scan-due-reminders.js";
import { loadNotificationsConfig } from "./config.js";

const subtasksCreatedSchema = z.object({
  userId: z.uuid(),
  activityId: z.uuid(),
  activityTitle: z.string(),
  subtaskTitles: z.array(z.string()).min(1).max(10),
});

export function createNotificationsModule(context: ModuleContext): AppModule {
  const config = loadNotificationsConfig(context.env);
  const outbox = createDrizzleOutboxRepository(context.db);
  const reminders = createDrizzleReminderRepository(context.db);
  const templates = createNotificationEmailTemplates(config.APP_URL);
  context.events.subscribe("subtasks.created", async (event) => {
    try {
      const payload = subtasksCreatedSchema.parse(event.payload);
      await enqueueSubtaskEmail({ outbox, templates }, payload);
    } catch {
      // Database errors can include query parameters containing email content.
      throw new AppError(
        "unavailable",
        "SUBTASK_EMAIL_ENQUEUE_FAILED",
        "Subtask email enqueue failed",
      );
    }
  });
  return {
    name: "notifications",
    jobs: [
      {
        name: "notifications.reminder-scan",
        intervalMs: 60_000,
        async run() {
          try {
            const enqueued = await scanDueReminders({
              reminders,
              templates,
              leadMinutes: config.REMINDER_LEAD_MINUTES,
            });
            context.logger.info({ enqueued }, "Reminder scan completed");
          } catch {
            throw new AppError("unavailable", "REMINDER_SCAN_FAILED", "Reminder scan failed");
          }
        },
      },
      {
        name: "notifications.outbox-drain",
        intervalMs: 15_000,
        async run() {
          try {
            const counts = await drainOutbox({
              outbox,
              email: context.email,
              batchSize: config.OUTBOX_BATCH_SIZE,
            });
            context.logger.info(counts, "Email outbox drain completed");
          } catch {
            throw new AppError("unavailable", "OUTBOX_DRAIN_FAILED", "Email outbox drain failed");
          }
        },
      },
    ],
  };
}
