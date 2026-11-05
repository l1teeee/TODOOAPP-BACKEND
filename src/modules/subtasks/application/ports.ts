import type { Subtask } from "../domain/subtask.js";

export type SubtaskPatch = Partial<Pick<Subtask, "title" | "isDone">>;

export interface SubtaskRepository {
  list(userId: string, activityId: string): Promise<Subtask[]>;
  createMany(userId: string, activityId: string, titles: readonly string[]): Promise<Subtask[]>;
  update(userId: string, id: string, patch: SubtaskPatch): Promise<Subtask | null>;
  remove(userId: string, id: string): Promise<boolean>;
}
