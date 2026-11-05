import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { AuthMailer, EmailCooldown, HumanVerifier, IdentityAdmin } from "../ports.js";
import { createRequestPasswordReset } from "../request-password-reset.js";

describe("request password reset", () => {
  const verify = jest.fn<HumanVerifier["verify"]>();
  const acquire = jest.fn<EmailCooldown["tryAcquire"]>();
  const signup = jest.fn<IdentityAdmin["createSignupCode"]>();
  const recovery = jest.fn<IdentityAdmin["createRecoveryCode"]>();
  const login = jest.fn<IdentityAdmin["createLoginCode"]>();
  const signupMail = jest.fn<AuthMailer["sendSignupCode"]>();
  const accountExists = jest.fn<AuthMailer["sendAccountExists"]>();
  const recoveryMail = jest.fn<AuthMailer["sendRecoveryCode"]>();
  const loginMail = jest.fn<AuthMailer["sendLoginCode"]>();
  let tasks: (() => Promise<void>)[];
  const input = { email: "ana@example.com", turnstileToken: "token", remoteIp: "127.0.0.1" };
  beforeEach(() => {
    tasks = [];
    jest.clearAllMocks();
    verify.mockResolvedValue(true);
    acquire.mockResolvedValue(true);
    recovery.mockResolvedValue({ status: "created", code: "123456" });
    recoveryMail.mockResolvedValue();
  });
  const run = () =>
    createRequestPasswordReset({
      humanVerifier: { verify },
      emailCooldown: { tryAcquire: acquire },
      identityAdmin: {
        createSignupCode: signup,
        createRecoveryCode: recovery,
        createLoginCode: login,
      },
      mailer: {
        sendSignupCode: signupMail,
        sendAccountExists: accountExists,
        sendRecoveryCode: recoveryMail,
        sendLoginCode: loginMail,
      },
      runInBackground: (task) => {
        tasks.push(task);
      },
    })(input);
  it("rejects failed verification without scheduling work", async () => {
    verify.mockResolvedValue(false);
    await expect(run()).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
    expect(verify).toHaveBeenCalledWith({ token: "token", remoteIp: "127.0.0.1" });
    expect(tasks).toHaveLength(0);
  });
  it("queues recovery and sends its code after resolving", async () => {
    await expect(run()).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledWith({ token: "token", remoteIp: "127.0.0.1" });
    expect(recoveryMail).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(acquire).toHaveBeenCalledWith("recovery", input.email);
    expect(recovery).toHaveBeenCalledWith(input.email);
    expect(recoveryMail).toHaveBeenCalledWith({ to: input.email, code: "123456" });
  });
  it("does not reveal unknown email addresses", async () => {
    recovery.mockResolvedValue({ status: "unknown_email" });
    await expect(run()).resolves.toBeUndefined();
    await tasks[0]?.();
    expect(recoveryMail).not.toHaveBeenCalled();
  });
  it("stops when cooldown is refused", async () => {
    acquire.mockResolvedValue(false);
    await run();
    await tasks[0]?.();
    expect(recovery).not.toHaveBeenCalled();
    expect(recoveryMail).not.toHaveBeenCalled();
  });
});
