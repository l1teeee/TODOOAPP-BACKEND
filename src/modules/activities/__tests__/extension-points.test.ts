import { describe, it, expect, beforeEach } from "@jest/globals";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { createExtensionPoints } from "../extension-points.js";

const view = (field: string) => ({
  field,
  schema: z.string(),
  fallback: "",
  load: () => Promise.resolve(new Map<string, string>()),
});
const filter = (param: string) => ({ param, schema: z.string(), condition: () => sql`true` });
const write = (field: string) => ({ field, schema: z.string(), apply: () => Promise.resolve() });

describe("activity extension points", () => {
  let registry: ReturnType<typeof createExtensionPoints>;
  beforeEach(() => {
    registry = createExtensionPoints();
  });

  it("returns each type in registration order", () => {
    const views = [view("first"), view("second")];
    const filters = [filter("first"), filter("second")];
    const writes = [write("first"), write("second")];
    views.forEach((extension) => {
      registry.addView(extension);
    });
    filters.forEach((extension) => {
      registry.addFilter(extension);
    });
    writes.forEach((extension) => {
      registry.addWrite(extension);
    });
    expect(registry.views()).toEqual(views);
    expect(registry.filters()).toEqual(filters);
    expect(registry.writes()).toEqual(writes);
  });

  it("rejects core and duplicate names within each type", () => {
    expect(() => {
      registry.addView(view("title"));
    }).toThrow("already registered or reserved");
    expect(() => {
      registry.addFilter(filter("status"));
    }).toThrow("already registered or reserved");
    expect(() => {
      registry.addWrite(write("kind"));
    }).toThrow("already registered or reserved");
    registry.addView(view("extra"));
    registry.addFilter(filter("extra"));
    registry.addWrite(write("extra"));
    expect(() => {
      registry.addView(view("extra"));
    }).toThrow("already registered or reserved");
    expect(() => {
      registry.addFilter(filter("extra"));
    }).toThrow("already registered or reserved");
    expect(() => {
      registry.addWrite(write("extra"));
    }).toThrow("already registered or reserved");
  });

  it("rejects registrations after freezing", () => {
    registry.freeze();
    expect(() => {
      registry.addView(view("extra"));
    }).toThrow("must be registered before routes");
    expect(() => {
      registry.addFilter(filter("extra"));
    }).toThrow("must be registered before routes");
    expect(() => {
      registry.addWrite(write("extra"));
    }).toThrow("must be registered before routes");
  });
});
