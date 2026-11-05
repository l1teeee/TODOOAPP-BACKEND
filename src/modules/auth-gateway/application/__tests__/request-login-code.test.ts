import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { AuthMailer, EmailCooldown, IdentityAdmin, ProfileDirectory } from "../ports.js";
import { createRequestLoginCode } from "../request-login-code.js";

describe("request login code", () => {
  const acquire = jest.fn<EmailCooldown["tryAcquire"]>();
  const find = jest.fn<ProfileDirectory["findIdByEmail"]>();
  const signup = jest.fn<IdentityAdmin["createSignupCode"]>();
  const recovery = jest.fn<IdentityAdmin["createRecoveryCode"]>();
  const login = jest.fn<IdentityAdmin["createLoginCode"]>();
  const signupMail = jest.fn<AuthMailer["sendSignupCode"]>();
  const accountExists = jest.fn<AuthMailer["sendAccountExists"]>();
  const recoveryMail = jest.fn<AuthMailer["sendRecoveryCode"]>();
  const loginMail = jest.fn<AuthMailer["sendLoginCode"]>();
  let tasks: (() => Promise<void>)[];
  beforeEach(() => {
    tasks = [];
    jest.clearAllMocks();
    acquire.mockResolvedValue(true);
    find.mockResolvedValue("user-1");
    login.mockResolvedValue({ status: "created", code: "123456" });
    loginMail.mockResolvedValue();
  });
  const run = () => {
    createRequestLoginCode({
      emailCooldown: { tryAcquire: acquire },
      profileDirectory: { findIdByEmail: find },
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
    })({ email: "ana@example.com" });
  };
  it("returns synchronously and queues a login mail", async () => {
    run();
    expect(tasks).toHaveLength(1);
    expect(loginMail).not.toHaveBeenCalled();
    await tasks[0]?.();
    expect(acquire).toHaveBeenCalledWith("login", "ana@example.com");
    expect(login).toHaveBeenCalledWith({ userId: "user-1", email: "ana@example.com" });
    expect(loginMail).toHaveBeenCalledWith({ to: "ana@example.com", code: "123456" });
  });
  it("does nothing for an unknown profile", async () => {
    find.mockResolvedValue(null);
    run();
    await tasks[0]?.();
    expect(login).not.toHaveBeenCalled();
    expect(loginMail).not.toHaveBeenCalled();
  });
  it("does not send for an unknown identity email", async () => {
    login.mockResolvedValue({ status: "unknown_email" });
    run();
    await tasks[0]?.();
    expect(loginMail).not.toHaveBeenCalled();
  });
  it("stops when cooldown is refused", async () => {
    acquire.mockResolvedValue(false);
    run();
    await tasks[0]?.();
    expect(find).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
    expect(loginMail).not.toHaveBeenCalled();
  });
});
