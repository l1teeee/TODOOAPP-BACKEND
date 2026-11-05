import type { AuthMailer, BackgroundRunner, EmailCooldown, IdentityAdmin } from "./ports.js";

export function createRequestLoginCode(deps: {
  identityAdmin: IdentityAdmin;
  mailer: AuthMailer;
  emailCooldown: EmailCooldown;
  runInBackground: BackgroundRunner;
}) {
  return (input: { email: string }): Promise<void> => {
    deps.runInBackground(async () => {
      const acquired = await deps.emailCooldown.tryAcquire(input.email);
      if (!acquired) {
        return;
      }
      const result = await deps.identityAdmin.createLoginCode(input.email);
      if (result.status === "created") {
        await deps.mailer.sendLoginCode({ to: input.email, code: result.code });
      }
    });
    return Promise.resolve();
  };
}
