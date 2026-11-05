import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import pino from "pino";
import { createDeepinfraTextGenerator } from "../deepinfra-text-generator.js";

describe("DeepInfra text generator", () => {
  const logger = pino({ level: "silent" });
  const generator = createDeepinfraTextGenerator({
    apiKey: "key",
    model: "model",
    timeoutMs: 5000,
    logger,
  });
  const suggest = () => generator.suggest({ title: "<b>x</b>", description: null });
  const input = { firstName: "<Ana", localTime: "09:00", locale: "en", items: [] };
  const response = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("posts escaped input and returns trimmed unique suggestions", async () => {
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(JSON.stringify({ subtasks: [" one ", "one", "two"] })));
    await expect(suggest()).resolves.toEqual(["one", "two"]);
    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe("https://api.deepinfra.com/v1/openai/chat/completions");
    expect(call?.[1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer key" } });
    const requestBody = call?.[1]?.body;
    if (typeof requestBody !== "string") throw new Error("Expected a JSON request body");
    const body = JSON.parse(requestBody) as {
      model: string;
      response_format: { type: string };
      messages: { content: string }[];
    };
    expect(body.model).toBe("model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1]?.content).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
  it.each([JSON.stringify({ subtasks: ["a", "b", "c", "d", "e", "f"] }), "not json"])(
    "rejects invalid content",
    async (content) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(response(content));
      await expect(suggest()).rejects.toMatchObject({ code: "AI_BAD_RESPONSE" });
    },
  );
  it("rejects an envelope without choices", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await expect(suggest()).rejects.toMatchObject({ code: "AI_BAD_RESPONSE" });
  });
  it.each([
    [401, "AI_UNAVAILABLE"],
    [429, "AI_RATE_LIMITED"],
    [500, "AI_UNAVAILABLE"],
  ] as const)("maps HTTP %i", async (status, code) => {
    const error = jest.spyOn(logger, "error");
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status }));
    await expect(suggest()).rejects.toMatchObject({ code });
    if (status === 401) expect(error).toHaveBeenCalled();
  });
  it("maps network failure", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(suggest()).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
  it("rejects bodies above the size limit", async () => {
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { headers: { "content-length": "65537" } }))
      .mockResolvedValueOnce(new Response("x".repeat(65537)));
    await expect(suggest()).rejects.toMatchObject({ code: "AI_BAD_RESPONSE" });
    await expect(suggest()).rejects.toMatchObject({ code: "AI_BAD_RESPONSE" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("strips control characters and escapes input data", async () => {
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(JSON.stringify({ message: " hi\u0007\u200B there " })));
    await expect(generator.write(input)).resolves.toBe("hi there");
    const requestBody = fetch.mock.calls[0]?.[1]?.body;
    if (typeof requestBody !== "string") throw new Error("Expected a JSON request body");
    const body = JSON.parse(requestBody) as {
      messages: { content: string }[];
    };
    expect(body.messages[1]?.content).toContain("\\u003cAna");
  });
  it("rejects messages longer than 280 characters", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(JSON.stringify({ message: "x".repeat(281) })));
    await expect(generator.write(input)).rejects.toMatchObject({ code: "AI_BAD_RESPONSE" });
  });
});
