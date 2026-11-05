import { AppError } from "../../../platform/errors/app-error.js";

export function subtaskNotFound(): AppError {
  return new AppError("not_found", "SUBTASK_NOT_FOUND", "Subtask not found");
}
