import { describe, it, expect } from "@jest/globals";
import { renderEmail } from "../email-layout.js";

describe("email layout", () => {
  const raw = `<script>alert("x")</script> & 'q'`;
  const footer = "Sent by TODO App. You received this because of activity on your account.";
  it("escapes every HTML field and preserves raw text", () => {
    const result = renderEmail({
      preheader: raw,
      title: raw,
      intro: raw,
      code: raw,
      action: { label: raw, url: "https://app.example.com/today" },
      details: [{ label: raw, value: raw }],
      outro: raw,
    });
    const escaped = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;";
    expect(result.html.split(escaped).length - 1).toBe(9);
    expect(result.html).not.toContain("<script>");
    expect(result.text).toBe(
      [
        "TODO App",
        raw,
        raw,
        raw,
        raw,
        `${raw}: https://app.example.com/today`,
        `${raw}: ${raw}`,
        raw,
        footer,
      ].join("\n\n"),
    );
  });
  it("omits empty optional parts from text", () => {
    expect(renderEmail({ preheader: "Preview", title: "Title", intro: "Intro" }).text).toBe(
      ["TODO App", "Preview", "Title", "Intro", footer].join("\n\n"),
    );
  });
  it.each(["https://app.example.com/today", "http://localhost:3000/today"])("allows %s", (url) => {
    expect(() => {
      renderEmail({ preheader: "p", title: "t", intro: "i", action: { label: "Go", url } });
    }).not.toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
    "http://localhost.evil.com/x",
    "data:text/html,hi",
    "not a url",
  ])("rejects %s", (url) => {
    expect(() => {
      renderEmail({ preheader: "p", title: "t", intro: "i", action: { label: "Go", url } });
    }).toThrow(expect.objectContaining({ code: "INVALID_EMAIL_URL" }));
  });
});
