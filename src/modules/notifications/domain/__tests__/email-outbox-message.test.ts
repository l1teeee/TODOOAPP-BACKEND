import { describe, it, expect } from "@jest/globals";
import {
  MAX_ATTEMPTS,
  nextAttemptDelayMinutes,
  nextStatusAfterFailure,
} from "../email-outbox-message.js";

describe("outbox retry rules", () => {
  it.each([
    [1, 2],
    [2, 4],
    [3, 8],
    [4, 16],
  ])("delays attempt %i by %i minutes", (attempt, delay) => {
    expect(nextAttemptDelayMinutes(attempt)).toBe(delay);
  });
  it.each([1, 2, 3, 4])("keeps attempt %i pending", (attempt) => {
    expect(nextStatusAfterFailure(attempt)).toBe("pending");
  });
  it.each([MAX_ATTEMPTS, MAX_ATTEMPTS + 1])("fails attempt %i", (attempt) => {
    expect(nextStatusAfterFailure(attempt)).toBe("failed");
  });
});
