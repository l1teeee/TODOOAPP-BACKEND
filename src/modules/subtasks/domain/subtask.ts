import { AppError } from "../../../platform/errors/app-error.js";

export interface Subtask {
  id: string;
  activityId: string;
  title: string;
  isDone: boolean;
  position: number;
}

export function subtaskTitle(value: string): string {
  const title = value.trim();
  if (title.length < 1 || title.length > 120) {
    throw new AppError("invalid", "SUBTASK_INVALID", "Subtask title must be 1-120 characters");
  }
  return title;
}
