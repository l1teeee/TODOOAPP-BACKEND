import { AppError } from "../../../platform/errors/app-error.js";
import type { EventBus } from "../../../platform/events/event-bus.js";
import type { ActivityAccess } from "../../activities/public.js";
import { subtaskTitle } from "../domain/subtask.js";
import { subtaskNotFound } from "../domain/subtask-errors.js";
import type { SubtaskPatch, SubtaskRepository } from "./ports.js";

export function createSubtaskUseCases(deps: {
  repository: SubtaskRepository;
  access: ActivityAccess;
  events: EventBus;
}) {
  const { repository, access, events } = deps;

  async function findActivity(userId: string, activityId: string) {
    const activity = await access.findOwned({ userId, activityId });
    if (!activity) {
      throw new AppError("not_found", "ACTIVITY_NOT_FOUND", "Activity not found");
    }
    return activity;
  }

  async function createMany(userId: string, activityId: string, titles: readonly string[]) {
    const activity = await findActivity(userId, activityId);
    const subtaskTitles = titles.map(subtaskTitle);
    const items = await repository.createMany(userId, activityId, subtaskTitles);
    await events.publish({
      type: "subtasks.created",
      occurredAt: new Date().toISOString(),
      payload: { userId, activityId, activityTitle: activity.title, subtaskTitles },
    });
    return items;
  }

  return {
    async list(userId: string, activityId: string) {
      await findActivity(userId, activityId);
      return repository.list(userId, activityId);
    },
    async create(userId: string, activityId: string, title: string) {
      const [item] = await createMany(userId, activityId, [title]);
      if (!item) {
        throw new Error("Subtask insert returned no row");
      }
      return item;
    },
    createMany,
    async update(userId: string, id: string, patch: SubtaskPatch) {
      const fields = { ...patch };
      if (fields.title !== undefined) {
        fields.title = subtaskTitle(fields.title);
      }
      const item = await repository.update(userId, id, fields);
      if (!item) {
        throw subtaskNotFound();
      }
      return item;
    },
    async remove(userId: string, id: string): Promise<void> {
      if (!(await repository.remove(userId, id))) {
        throw subtaskNotFound();
      }
    },
  };
}
