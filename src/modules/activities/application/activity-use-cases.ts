import { assertActivityRules, statusChange } from "../domain/activity.js";
import type { Activity } from "../domain/activity.js";
import { activityNotFound, activityNotInTrash } from "../domain/activity-errors.js";
import type {
  ActivityFields,
  ActivityListQuery,
  ActivityPatch,
  ActivityRepository,
  CreateActivityFields,
  Page,
  PageResult,
} from "./ports.js";

export async function createActivity(
  repository: ActivityRepository,
  userId: string,
  input: CreateActivityFields,
  extensionValues: Readonly<Record<string, unknown>>,
): Promise<Activity> {
  const status = input.status ?? "todo";
  const fields: ActivityFields = {
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    status,
    scheduledDate: input.scheduledDate ?? null,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    location: input.location ?? null,
    icon: input.icon ?? null,
    completedAt: statusChange({ status: "todo", completedAt: null }, status, new Date()),
  };
  assertActivityRules(fields);
  return repository.create(userId, fields, extensionValues);
}

export async function updateActivity(
  repository: ActivityRepository,
  userId: string,
  id: string,
  patch: ActivityPatch,
  extensionValues: Readonly<Record<string, unknown>>,
): Promise<Activity> {
  const current = await getActivity(repository, userId, id);
  if (current.deletedAt !== null) {
    throw activityNotFound();
  }
  const merged = { ...current, ...patch };
  assertActivityRules(merged);
  const updated = await repository.update(userId, id, patch, extensionValues);
  if (!updated) {
    throw activityNotFound();
  }
  return updated;
}

export async function getActivity(
  repository: ActivityRepository,
  userId: string,
  id: string,
): Promise<Activity> {
  const activity = await repository.findOwned(userId, id);
  if (!activity) {
    throw activityNotFound();
  }
  return activity;
}

export function listActivities(
  repository: ActivityRepository,
  userId: string,
  query: ActivityListQuery,
): Promise<Activity[]> {
  return repository.list(userId, query);
}

export function listCompletedActivities(
  repository: ActivityRepository,
  userId: string,
  page: Page,
): Promise<PageResult> {
  return repository.listCompleted(userId, page);
}

export function listTrashedActivities(
  repository: ActivityRepository,
  userId: string,
  page: Page,
): Promise<PageResult> {
  return repository.listTrashed(userId, page);
}

export async function trashActivity(
  repository: ActivityRepository,
  userId: string,
  id: string,
): Promise<Activity> {
  const activity = await repository.trash(userId, id);
  if (!activity) {
    throw activityNotFound();
  }
  return activity;
}

export async function restoreActivity(
  repository: ActivityRepository,
  userId: string,
  id: string,
): Promise<Activity> {
  const activity = await repository.restore(userId, id);
  if (!activity) {
    throw activityNotFound();
  }
  return activity;
}

export async function deleteActivityForever(
  repository: ActivityRepository,
  userId: string,
  id: string,
): Promise<void> {
  const result = await repository.deleteForever(userId, id);
  if (result === "not_found") {
    throw activityNotFound();
  }
  if (result === "not_in_trash") {
    throw activityNotInTrash();
  }
}
