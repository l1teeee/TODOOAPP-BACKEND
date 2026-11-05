import { AppError } from "../../../platform/errors/app-error.js";

export function captchaFailed(): AppError {
  return new AppError("invalid", "CAPTCHA_FAILED", "Bot verification failed. Try again.");
}

export function captchaUnavailable(): AppError {
  return new AppError(
    "unavailable",
    "CAPTCHA_UNAVAILABLE",
    "Bot verification is unavailable. Try again.",
  );
}

export function identityUnavailable(cause?: unknown): AppError {
  const error = new AppError(
    "unavailable",
    "IDENTITY_UNAVAILABLE",
    "Account service is unavailable. Try again.",
  );
  error.cause = cause;
  return error;
}
