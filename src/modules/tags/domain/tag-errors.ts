import { AppError } from "../../../platform/errors/app-error.js";

export function tagNotFound(): AppError {
  return new AppError("not_found", "TAG_NOT_FOUND", "Tag not found");
}

export function tagNameTaken(): AppError {
  return new AppError("conflict", "TAG_NAME_TAKEN", "Tag name is already taken");
}

export function tagLimitReached(): AppError {
  return new AppError("conflict", "TAG_LIMIT_REACHED", "A user can have at most 200 tags");
}
