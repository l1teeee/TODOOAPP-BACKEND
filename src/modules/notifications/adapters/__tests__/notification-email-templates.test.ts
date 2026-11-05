import { describe, it, expect } from "@jest/globals";
import { createNotificationEmailTemplates } from "../notification-email-templates.js";

describe("notification email templates", () => {
  it("links to the app and escapes activity titles", () => {
    const templates = createNotificationEmailTemplates("https://app.example.com");
    const to = "ana@example.com";
    const title = "<img src=x>";
    const messages = [
      templates.reminderDue({
        userId: "user",
        activityId: "activity",
        title,
        to,
        scheduledDate: "2026-01-01",
        startTime: "09:00",
        location: null,
      }),
      templates.subtaskCreated({
        userId: "user",
        activityId: "activity",
        activityTitle: title,
        subtaskTitles: ["subtask"],
        to,
        displayName: null,
      }),
    ];
    for (const message of messages) {
      expect(message.to).toBe(to);
      expect(message.html).toContain("https://app.example.com/");
      expect(message.html).toContain("&lt;img src=x&gt;");
      expect(message.html).not.toContain(title);
    }
  });
});
