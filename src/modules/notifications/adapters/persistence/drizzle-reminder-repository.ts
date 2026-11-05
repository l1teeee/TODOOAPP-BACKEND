import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import { activitiesTable } from "../../../activities/public.js";
import type { ReminderRepository } from "../../application/ports.js";
import { emailOutbox, reminderNotifications } from "./schema.js";

export function createDrizzleReminderRepository(db: DbExecutor): ReminderRepository {
  return {
    enqueueDue(leadMinutes, render) {
      // The render callback keeps reminder claims and rendered outbox inserts atomic.
      return db.transaction(async (tx) => {
        const remindAt = sql<Date>`case when ${profiles.timezone} in (select name from pg_timezone_names)
          then ((${activitiesTable.scheduledDate} + ${activitiesTable.startTime}) at time zone ${profiles.timezone}) end`;
        const inserted = tx.$with("inserted_reminders").as(
          tx
            .insert(reminderNotifications)
            .select(
              tx
                .select({
                  activityId: activitiesTable.id,
                  remindAt: remindAt.as("remind_at"),
                  userId: activitiesTable.userId,
                  createdAt: sql<Date>`now()`.as("created_at"),
                })
                .from(activitiesTable)
                .innerJoin(profiles, eq(profiles.id, activitiesTable.userId))
                .where(
                  and(
                    eq(activitiesTable.kind, "reminder"),
                    isNull(activitiesTable.deletedAt),
                    ne(activitiesTable.status, "completed"),
                    isNotNull(activitiesTable.scheduledDate),
                    isNotNull(activitiesTable.startTime),
                    eq(profiles.emailNotifications, true),
                    sql`${remindAt} between now() and now() + ${leadMinutes} * interval '1 minute'`,
                  ),
                ),
            )
            .onConflictDoNothing()
            .returning({
              activityId: reminderNotifications.activityId,
              remindAt: reminderNotifications.remindAt,
            }),
        );
        const reminders = await tx
          .with(inserted)
          .select({
            userId: activitiesTable.userId,
            activityId: activitiesTable.id,
            title: activitiesTable.title,
            to: profiles.email,
            scheduledDate: sql<string>`${activitiesTable.scheduledDate}`,
            startTime: sql<string>`${activitiesTable.startTime}`,
            location: activitiesTable.location,
          })
          .from(inserted)
          .innerJoin(activitiesTable, eq(activitiesTable.id, inserted.activityId))
          .innerJoin(profiles, eq(profiles.id, activitiesTable.userId));
        if (reminders.length === 0) {
          return 0;
        }
        await tx.insert(emailOutbox).values(
          reminders.map((reminder) => {
            const message = render(reminder);
            return {
              userId: reminder.userId,
              kind: "reminder_due",
              toEmail: message.to,
              subject: message.subject,
              html: message.html,
              text: message.text,
            };
          }),
        );
        return reminders.length;
      });
    },
  };
}
