import { describe, it, expect } from "@jest/globals";
import {
  signupCodeEmail,
  accountExistsEmail,
  recoveryCodeEmail,
  loginCodeEmail,
} from "../auth-email-templates.js";

describe("auth email templates", () => {
  it("preserves recipient, provides subjects, and includes codes", () => {
    const to = "ana@example.com";
    const code = "123456";
    const codeMessages = [
      signupCodeEmail({ to, code, fullName: "<b>Ana</b>" }),
      recoveryCodeEmail({ to, code }),
      loginCodeEmail({ to, code }),
    ];
    for (const message of [...codeMessages, accountExistsEmail({ to })]) {
      expect(message.to).toBe(to);
      expect(message.subject.length).toBeGreaterThan(0);
    }
    for (const message of codeMessages) {
      expect(message.html).toContain(code);
      expect(message.text).toContain(code);
    }
    expect(codeMessages[0]?.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(codeMessages[0]?.html).not.toContain("<b>Ana</b>");
  });
});
