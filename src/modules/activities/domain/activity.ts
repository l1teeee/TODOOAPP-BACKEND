import { activityInvalid } from "./activity-errors.js";

export type ActivityKind = "habit" | "reminder" | "task";
export type ActivityStatus = "todo" | "in_progress" | "completed";

export interface Activity {
  id: string;
  userId: string;
  kind: ActivityKind;
  title: string;
  description: string | null;
  status: ActivityStatus;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  icon: string | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function assertActivityRules(
  fields: Pick<Activity, "kind" | "scheduledDate" | "startTime" | "endTime" | "location">,
): void {
  if (fields.kind === "habit" && (fields.scheduledDate !== null || fields.location !== null)) {
    throw activityInvalid("Habits cannot have a scheduled date or location");
  }
  if (fields.kind === "reminder" && (fields.scheduledDate === null || fields.startTime === null)) {
    throw activityInvalid("Reminders require a scheduled date and start time");
  }
  if (fields.startTime !== null && fields.endTime !== null && fields.endTime <= fields.startTime) {
    throw activityInvalid("End time must be after start time");
  }
}

export function statusChange(
  current: Pick<Activity, "status" | "completedAt">,
  next: ActivityStatus,
  now: Date,
): Date | null {
  if (current.status === next) {
    return current.completedAt;
  }
  if (next === "completed") {
    return now;
  }
  if (current.status === "completed") {
    return null;
  }
  return current.completedAt;
}
