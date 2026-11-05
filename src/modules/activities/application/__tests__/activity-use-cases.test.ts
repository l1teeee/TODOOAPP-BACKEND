import { describe, it, expect, beforeEach } from "@jest/globals";
import type { Activity } from "../../domain/activity.js";
import type { ActivityFields, ActivityPatch, ActivityRepository } from "../ports.js";
import {
  createActivity,
  updateActivity,
  getActivity,
  trashActivity,
  restoreActivity,
  deleteActivityForever,
} from "../activity-use-cases.js";

class FakeRepository implements ActivityRepository {
  items = new Map<string, Activity>();
  extensionValues: Readonly<Record<string, unknown>> = {};
  updateReturnsNull = false;
  deleteResult: "deleted" | "not_found" | "not_in_trash" = "deleted";

  create(
    userId: string,
    fields: ActivityFields,
    extensionValues: Readonly<Record<string, unknown>>,
  ): Promise<Activity> {
    this.extensionValues = extensionValues;
    const now = new Date();
    const activity = {
      ...fields,
      id: "1",
      userId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(activity.id, activity);
    return Promise.resolve(activity);
  }
  update(
    userId: string,
    id: string,
    patch: ActivityPatch,
    extensionValues: Readonly<Record<string, unknown>>,
  ): Promise<Activity | null> {
    this.extensionValues = extensionValues;
    const current = this.items.get(id);
    if (this.updateReturnsNull || current?.userId !== userId) return Promise.resolve(null);
    const updated = { ...current, ...patch };
    this.items.set(id, updated);
    return Promise.resolve(updated);
  }
  findOwned(userId: string, id: string): Promise<Activity | null> {
    const activity = this.items.get(id);
    return Promise.resolve(activity?.userId === userId ? activity : null);
  }
  list(): Promise<Activity[]> {
    return Promise.resolve([]);
  }
  listCompleted(): Promise<{ items: Activity[]; nextCursor: null }> {
    return Promise.resolve({ items: [], nextCursor: null });
  }
  listTrashed(): Promise<{ items: Activity[]; nextCursor: null }> {
    return Promise.resolve({ items: [], nextCursor: null });
  }
  trash(): Promise<Activity | null> {
    return Promise.resolve(null);
  }
  restore(): Promise<Activity | null> {
    return Promise.resolve(null);
  }
  deleteForever(): Promise<"deleted" | "not_found" | "not_in_trash"> {
    return Promise.resolve(this.deleteResult);
  }
}

describe("activity use cases", () => {
  let repository: FakeRepository;
  beforeEach(() => {
    repository = new FakeRepository();
  });

  it("creates defaults and forwards extensions", async () => {
    const activity = await createActivity(
      repository,
      "user",
      { kind: "task", title: "Task" },
      { extra: 1 },
    );
    expect(activity).toMatchObject({
      status: "todo",
      description: null,
      scheduledDate: null,
      startTime: null,
      endTime: null,
      location: null,
      icon: null,
      completedAt: null,
    });
    expect(repository.extensionValues).toEqual({ extra: 1 });
    const completed = await createActivity(
      repository,
      "user",
      { kind: "task", title: "Done", status: "completed" },
      {},
    );
    expect(completed.completedAt).toBeInstanceOf(Date);
  });
  it("does not store invalid reminders", async () => {
    await expect(
      createActivity(repository, "user", { kind: "reminder", title: "Reminder" }, {}),
    ).rejects.toMatchObject({ code: "ACTIVITY_INVALID" });
    expect(repository.items.size).toBe(0);
  });
  it("rejects missing, unowned and trashed activities", async () => {
    await expect(updateActivity(repository, "user", "missing", {}, {})).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    const activity = await createActivity(repository, "other", { kind: "task", title: "Task" }, {});
    await expect(updateActivity(repository, "user", activity.id, {}, {})).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    repository.items.set(activity.id, { ...activity, userId: "user", deletedAt: new Date() });
    await expect(updateActivity(repository, "user", activity.id, {}, {})).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
  });
  it("validates merged updates and handles a missing update result", async () => {
    const activity = await createActivity(
      repository,
      "user",
      { kind: "reminder", title: "Reminder", scheduledDate: "2026-01-01", startTime: "09:00" },
      {},
    );
    await expect(
      updateActivity(repository, "user", activity.id, { scheduledDate: null }, {}),
    ).rejects.toMatchObject({ code: "ACTIVITY_INVALID" });
    expect(repository.items.get(activity.id)).toEqual(activity);
    await expect(
      updateActivity(repository, "user", activity.id, { title: "Updated" }, { extra: 2 }),
    ).resolves.toMatchObject({ title: "Updated" });
    expect(repository.extensionValues).toEqual({ extra: 2 });
    repository.updateReturnsNull = true;
    await expect(updateActivity(repository, "user", activity.id, {}, {})).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
  });
  it("maps missing reads and trash operations", async () => {
    await expect(getActivity(repository, "user", "missing")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    await expect(trashActivity(repository, "user", "missing")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    await expect(restoreActivity(repository, "user", "missing")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
  });
  it("maps permanent deletion results", async () => {
    repository.deleteResult = "not_found";
    await expect(deleteActivityForever(repository, "user", "1")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    repository.deleteResult = "not_in_trash";
    await expect(deleteActivityForever(repository, "user", "1")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_IN_TRASH",
      kind: "conflict",
    });
    repository.deleteResult = "deleted";
    await expect(deleteActivityForever(repository, "user", "1")).resolves.toBeUndefined();
  });
});
