import { describe, it, expect } from "@jest/globals";
import { assertActivityRules, statusChange } from "../activity.js";

describe("assertActivityRules", () => {
  const task = {
    kind: "task" as const,
    scheduledDate: null,
    startTime: null,
    endTime: null,
    location: null,
  };

  it("rejects habits with a date or location", () => {
    expect(() => {
      assertActivityRules({ ...task, kind: "habit", scheduledDate: "2026-01-01" });
    }).toThrow(expect.objectContaining({ code: "ACTIVITY_INVALID" }));
    expect(() => {
      assertActivityRules({ ...task, kind: "habit", location: "home" });
    }).toThrow(expect.objectContaining({ code: "ACTIVITY_INVALID" }));
  });

  it("accepts a plain habit and task", () => {
    expect(() => {
      assertActivityRules({ ...task, kind: "habit" });
    }).not.toThrow();
    expect(() => {
      assertActivityRules(task);
    }).not.toThrow();
  });

  it("requires both date and start time for reminders", () => {
    expect(() => {
      assertActivityRules({ ...task, kind: "reminder", startTime: "09:00" });
    }).toThrow(expect.objectContaining({ code: "ACTIVITY_INVALID" }));
    expect(() => {
      assertActivityRules({ ...task, kind: "reminder", scheduledDate: "2026-01-01" });
    }).toThrow(expect.objectContaining({ code: "ACTIVITY_INVALID" }));
    expect(() => {
      assertActivityRules({
        ...task,
        kind: "reminder",
        scheduledDate: "2026-01-01",
        startTime: "09:00",
      });
    }).not.toThrow();
  });

  it("requires end time to follow start time when both are present", () => {
    for (const endTime of ["09:00", "08:00"]) {
      expect(() => {
        assertActivityRules({ ...task, startTime: "09:00", endTime });
      }).toThrow(expect.objectContaining({ code: "ACTIVITY_INVALID" }));
    }
    expect(() => {
      assertActivityRules({ ...task, startTime: "09:00", endTime: "10:00" });
    }).not.toThrow();
    expect(() => {
      assertActivityRules({ ...task, startTime: "09:00" });
    }).not.toThrow();
    expect(() => {
      assertActivityRules({ ...task, endTime: "10:00" });
    }).not.toThrow();
  });
});

describe("statusChange", () => {
  const date = new Date("2026-01-01T00:00:00Z");
  const now = new Date("2026-01-02T00:00:00Z");

  it("preserves completion time for unchanged status", () => {
    expect(statusChange({ status: "completed", completedAt: date }, "completed", now)).toBe(date);
    expect(statusChange({ status: "todo", completedAt: null }, "todo", now)).toBeNull();
  });

  it("sets completion time on transition to completed", () => {
    expect(statusChange({ status: "todo", completedAt: null }, "completed", now)).toBe(now);
    expect(statusChange({ status: "in_progress", completedAt: null }, "completed", now)).toBe(now);
  });

  it("clears completion time when leaving completed", () => {
    expect(statusChange({ status: "completed", completedAt: date }, "todo", now)).toBeNull();
    expect(statusChange({ status: "completed", completedAt: date }, "in_progress", now)).toBeNull();
    expect(statusChange({ status: "todo", completedAt: date }, "in_progress", now)).toBe(date);
  });
});
