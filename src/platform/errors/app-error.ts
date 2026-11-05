export type AppErrorKind =
  "invalid" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "unavailable";

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
