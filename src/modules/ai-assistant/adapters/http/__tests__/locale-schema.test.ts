import { describe, it, expect } from "@jest/globals";
import { localeSchema } from "../ai-routes.js";

describe("locale schema", () => {
  it.each(["en", "en-US", "es-419", "pt-BR", "zh-Hant-TW"])("accepts %s", (locale) => {
    expect(localeSchema.safeParse(locale).success).toBe(true);
  });

  it.each([
    "",
    "e",
    "english",
    "es_ES",
    "en-",
    "-US",
    ("en-" + "a1b2c3d4-".repeat(4)).slice(0, 36),
  ])("rejects %s", (locale) => {
    expect(localeSchema.safeParse(locale).success).toBe(false);
  });
});
