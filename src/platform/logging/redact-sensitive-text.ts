import { pino } from "pino";

// Drizzle query errors carry parameter values in their messages.
export function redactSensitiveText(text: string): string {
  return text
    .replace(/^params:[\s\S]*/m, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
}

export function redactStringsDeep(value: unknown, depth = 5): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (depth <= 0 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value.map((entry: unknown) => redactStringsDeep(entry, depth - 1));
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]: [string, unknown]) => [
      key,
      redactStringsDeep(entry, depth - 1),
    ]),
  );
}

export function removeParams(value: unknown, seen = new WeakMap<object, object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  const existing = seen.get(value);
  if (existing) return existing;
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(value, result);
    for (const entry of value as unknown[]) result.push(removeParams(entry, seen));
    return result;
  }
  const result: Record<string, unknown> = {};
  seen.set(value, result);
  for (const [key, entry] of Object.entries(value)) {
    if (key !== "params")
      Object.defineProperty(result, key, {
        value: removeParams(entry, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
  }
  return result;
}

export function serializeError(error: Error): unknown {
  return redactStringsDeep(removeParams(pino.stdSerializers.err(error)));
}
