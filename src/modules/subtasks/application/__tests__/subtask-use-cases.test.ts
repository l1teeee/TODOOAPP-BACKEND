import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { ActivityAccess } from "../../../activities/public.js";
import type { EventBus } from "../../../../platform/events/event-bus.js";
import type { SubtaskRepository } from "../ports.js";
import { createSubtaskUseCases } from "../subtask-use-cases.js";

describe("subtask use cases", () => {
  const findOwned = jest.fn<ActivityAccess["findOwned"]>();
  const list = jest.fn<SubtaskRepository["list"]>();
  const createMany = jest.fn<SubtaskRepository["createMany"]>();
  const update = jest.fn<SubtaskRepository["update"]>();
  const remove = jest.fn<SubtaskRepository["remove"]>();
  const publish = jest.fn<EventBus["publish"]>();
  const subscribe = jest.fn<EventBus["subscribe"]>();
  const item = {
    id: "subtask",
    activityId: "activity",
    title: "First",
    isDone: false,
    position: 0,
  };
  const cases = createSubtaskUseCases({
    repository: { list, createMany, update, remove },
    access: { findOwned },
    events: { publish, subscribe },
  });
  beforeEach(() => {
    jest.resetAllMocks();
    findOwned.mockResolvedValue({ id: "activity", kind: "task", title: "Activity" });
    createMany.mockResolvedValue([item]);
    publish.mockResolvedValue();
  });
  it("rejects list and creates for an inaccessible activity without side effects", async () => {
    findOwned.mockResolvedValue(null);
    await expect(cases.list("user", "activity")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    await expect(cases.create("user", "activity", "First")).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    await expect(cases.createMany("user", "activity", ["First"])).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
    expect(createMany).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
  it("returns created items and publishes the activity details", async () => {
    await expect(cases.createMany("user", "activity", ["First"])).resolves.toEqual([item]);
    expect(createMany).toHaveBeenCalledWith("user", "activity", ["First"]);
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      type: "subtasks.created",
      payload: {
        userId: "user",
        activityId: "activity",
        activityTitle: "Activity",
        subtaskTitles: ["First"],
      },
    });
    expect(new Date(event?.occurredAt ?? "").toISOString()).toBe(event?.occurredAt);
  });
  it("returns the single created item", async () => {
    await expect(cases.create("user", "activity", "First")).resolves.toEqual(item);
  });
  it("rejects missing updates and removals", async () => {
    update.mockResolvedValue(null);
    remove.mockResolvedValue(false);
    await expect(cases.update("user", "missing", {})).rejects.toMatchObject({
      code: "SUBTASK_NOT_FOUND",
    });
    await expect(cases.remove("user", "missing")).rejects.toMatchObject({
      code: "SUBTASK_NOT_FOUND",
    });
  });
});
