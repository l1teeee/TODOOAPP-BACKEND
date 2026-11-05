function hasPostgresError(error: unknown, code: string, constraint?: string): boolean {
  while (typeof error === "object" && error !== null) {
    if (
      "code" in error &&
      error.code === code &&
      (constraint === undefined || ("constraint" in error && error.constraint === constraint))
    ) {
      return true;
    }
    error = "cause" in error ? error.cause : undefined;
  }
  return false;
}

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return hasPostgresError(error, "23505", constraint);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPostgresError(error, "23503");
}
