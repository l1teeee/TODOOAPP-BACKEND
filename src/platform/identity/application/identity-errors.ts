import { AppError } from "../../errors/app-error.js";

export function missingToken(): AppError {
  return new AppError("unauthorized", "MISSING_TOKEN", "Bearer token required");
}

export function invalidToken(): AppError {
  return new AppError("unauthorized", "INVALID_TOKEN", "Invalid or expired token");
}

export function profileNotFound(): AppError {
  return new AppError("not_found", "PROFILE_NOT_FOUND", "Profile not found");
}
