import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { createRecentlyEnsuredUsers } from "../recently-ensured-users.js";

describe("recently ensured users", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it("expires remembered users after the TTL", () => {
    const users = createRecentlyEnsuredUsers({ ttlMs: 1000, maxEntries: 2 });
    expect(users.has("a")).toBe(false);
    users.remember("a");
    expect(users.has("a")).toBe(true);
    jest.advanceTimersByTime(1000);
    expect(users.has("a")).toBe(false);
  });
  it("evicts the oldest and refreshes insertion order", () => {
    const users = createRecentlyEnsuredUsers({ ttlMs: 1000, maxEntries: 2 });
    users.remember("a");
    users.remember("b");
    users.remember("c");
    expect(users.has("a")).toBe(false);
    users.remember("b");
    users.remember("d");
    expect(users.has("c")).toBe(false);
    expect(users.has("b")).toBe(true);
    expect(users.has("d")).toBe(true);
  });
});
