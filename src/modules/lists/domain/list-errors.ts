import { AppError } from "../../../platform/errors/app-error.js";

export function listNotFound(): AppError {
  return new AppError("not_found", "LIST_NOT_FOUND", "List not found");
}

export function listNameTaken(): AppError {
  return new AppError("conflict", "LIST_NAME_TAKEN", "List name is already taken");
}

export function listLimitReached(): AppError {
  return new AppError("conflict", "LIST_LIMIT_REACHED", "A user can have at most 200 lists");
}
