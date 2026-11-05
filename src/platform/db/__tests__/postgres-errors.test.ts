import { describe, it, expect } from "@jest/globals";
import { isUniqueViolation, isForeignKeyViolation } from "../postgres-errors.js";

describe("Postgres errors", () => {
  it("recognizes unique violations including nested causes", () => {
    const error = { code: "23505", constraint: "c" };
    expect(isUniqueViolation(error, "c")).toBe(true);
    expect(isUniqueViolation(new Error("wrapped", { cause: error }), "c")).toBe(true);
    expect(isUniqueViolation(error, "other")).toBe(false);
    expect(isUniqueViolation({ code: "23503", constraint: "c" }, "c")).toBe(false);
    expect(isUniqueViolation(null, "c")).toBe(false);
    expect(isUniqueViolation("23505", "c")).toBe(false);
  });
  it("recognizes foreign key violations including nested causes", () => {
    const error = { code: "23503" };
    expect(isForeignKeyViolation(error)).toBe(true);
    expect(isForeignKeyViolation(new Error("wrapped", { cause: error }))).toBe(true);
  });
});
