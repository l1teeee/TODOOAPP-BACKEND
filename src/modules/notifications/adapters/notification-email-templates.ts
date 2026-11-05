import { renderEmail } from "../../../platform/email/email-layout.js";
import type { NotificationEmailTemplates } from "../application/ports.js";

const outro = "You receive this because email notifications are on. Turn them off in Settings.";

export function createNotificationEmailTemplates(appUrl: string): NotificationEmailTemplates {
  return {
    reminderDue(input) {
      const time = input.startTime.slice(0, 5);
      const subject = `Reminder: ${input.title} at ${time}`;
      const details = [
        { label: "Date", value: input.scheduledDate },
        { label: "Time", value: time },
      ];
      if (input.location) {
        details.push({ label: "Location", value: input.location });
      }
      return {
        to: input.to,
        subject,
        ...renderEmail({
          preheader: subject,
          title: `Coming up at ${time}`,
          intro: `Your reminder "${input.title}" is coming up.`,
          details,
          action: { label: "Open TODO App", url: `${appUrl}/today?activity=${input.activityId}` },
          outro,
        }),
      };
    },
    subtaskCreated(input) {
      const subject = `New subtasks in ${input.activityTitle}`;
      const intro = `New subtasks were added to "${input.activityTitle}".`;
      return {
        to: input.to,
        subject,
        ...renderEmail({
          preheader: subject,
          title: "New subtasks added",
          intro: input.displayName ? `Hello ${input.displayName}, ${intro}` : intro,
          details: input.subtaskTitles.map((title, index) => ({
            label: `Subtask ${String(index + 1)}`,
            value: title,
          })),
          action: { label: "Open TODO App", url: `${appUrl}/all?activity=${input.activityId}` },
          outro,
        }),
      };
    },
  };
}
