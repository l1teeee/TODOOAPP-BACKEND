import { describe, it, expect, jest } from "@jest/globals";
import pino from "pino";
import { createInProcessEventBus } from "../event-bus.js";

describe("in-process event bus", () => {
  const event = { type: "created", occurredAt: "2026-01-01T00:00:00.000Z", payload: {} };
  it("runs matching handlers in subscription order", async () => {
    const bus = createInProcessEventBus(pino({ level: "silent" }));
    const calls: string[] = [];
    bus.subscribe("created", () => {
      calls.push("first");
      return Promise.resolve();
    });
    bus.subscribe("other", () => {
      calls.push("other");
      return Promise.resolve();
    });
    bus.subscribe("created", () => {
      calls.push("second");
      return Promise.resolve();
    });
    await bus.publish(event);
    expect(calls).toEqual(["first", "second"]);
  });
  it("logs failed handlers and continues", async () => {
    const logger = pino({ level: "silent" });
    const error = jest.spyOn(logger, "error");
    const bus = createInProcessEventBus(logger);
    const next = jest.fn<() => Promise<void>>().mockResolvedValue();
    bus.subscribe("created", () => Promise.reject(new Error("failure")));
    bus.subscribe("created", next);
    await expect(bus.publish(event)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "created" }),
      "Event handler failed",
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
  it("resolves without subscribers", async () => {
    await expect(
      createInProcessEventBus(pino({ level: "silent" })).publish(event),
    ).resolves.toBeUndefined();
  });
});
