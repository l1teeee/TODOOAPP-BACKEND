import { describe, it, expect, jest } from "@jest/globals";
import { createTurnstileHumanVerifier } from "../turnstile-human-verifier.js";

describe("Turnstile verifier", () => {
  const verifier = createTurnstileHumanVerifier("secret");
  const input = { token: "token", remoteIp: "127.0.0.1" };
  it.each([true, false])("posts form fields and returns success %s", async (success) => {
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success })));
    await expect(verifier.verify(input)).resolves.toBe(success);
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: new URLSearchParams({ secret: "secret", response: "token", remoteip: "127.0.0.1" }),
      }),
    );
  });
  it("rejects unsuccessful HTTP responses", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    await expect(verifier.verify(input)).rejects.toMatchObject({ code: "CAPTCHA_UNAVAILABLE" });
  });
  it("rejects fetch failures", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(verifier.verify(input)).rejects.toMatchObject({ code: "CAPTCHA_UNAVAILABLE" });
  });
  it("rejects malformed responses", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await expect(verifier.verify(input)).rejects.toMatchObject({ code: "CAPTCHA_UNAVAILABLE" });
  });
});
