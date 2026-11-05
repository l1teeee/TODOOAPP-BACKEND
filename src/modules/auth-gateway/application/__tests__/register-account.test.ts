import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { AuthMailer, EmailCooldown, HumanVerifier, IdentityAdmin } from "../ports.js";
import { createRegisterAccount } from "../register-account.js";

describe("register account", () => {
  const verify = jest.fn<HumanVerifier["verify"]>();
  const acquire = jest.fn<EmailCooldown["tryAcquire"]>();
  const signup = jest.fn<IdentityAdmin["createSignupCode"]>();
  const accountExists = jest.fn<AuthMailer["sendAccountExists"]>();
  const signupMail = jest.fn<AuthMailer["sendSignupCode"]>();
  const recovery = jest.fn<IdentityAdmin["createRecoveryCode"]>();
  const login = jest.fn<IdentityAdmin["createLoginCode"]>();
  const recoveryMail = jest.fn<AuthMailer["sendRecoveryCode"]>();
  const loginMail = jest.fn<AuthMailer["sendLoginCode"]>();
  let tasks: (() => Promise<void>)[];
  const input = {
    email: "ana@example.com",
    password: "password",
    fullName: "Ana",
    turnstileToken: "token",
    remoteIp: "127.0.0.1",
  };
  beforeEach(() => {
    tasks = [];
    jest.clearAllMocks();
    verify.mockResolvedValue(true);
    acquire.mockResolvedValue(true);
    signup.mockResolvedValue({ status: "created", code: "123456" });
    signupMail.mockResolvedValue();
    accountExists.mockResolvedValue();
  });
  const run = () =>
    createRegisterAccount({
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
  it("queues signup and sends its code after the call resolves", async () => {
    await expect(run()).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledWith({ token: "token", remoteIp: "127.0.0.1" });
    expect(signupMail).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(acquire).toHaveBeenCalledWith("signup", input.email);
    expect(signupMail).toHaveBeenCalledWith({ to: input.email, fullName: "Ana", code: "123456" });
    expect(accountExists).not.toHaveBeenCalled();
  });
  it("sends only account-exists mail for an existing account", async () => {
    signup.mockResolvedValue({ status: "already_registered" });
    await run();
    await tasks[0]?.();
    expect(accountExists).toHaveBeenCalledWith({ to: input.email });
    expect(signupMail).not.toHaveBeenCalled();
  });
  it("stops when cooldown is refused", async () => {
    acquire.mockResolvedValue(false);
    await run();
    await tasks[0]?.();
    expect(signup).not.toHaveBeenCalled();
    expect(signupMail).not.toHaveBeenCalled();
    expect(accountExists).not.toHaveBeenCalled();
  });
});
