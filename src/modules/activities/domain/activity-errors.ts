import { AppError } from "../../../platform/errors/app-error.js";

export function activityNotFound(): AppError {
  return new AppError("not_found", "ACTIVITY_NOT_FOUND", "Activity not found");
}

export function activityInvalid(message: string): AppError {
  return new AppError("invalid", "ACTIVITY_INVALID", message);
}

export function activityNotInTrash(): AppError {
  return new AppError("conflict", "ACTIVITY_NOT_IN_TRASH", "Activity is not in the trash");
}
