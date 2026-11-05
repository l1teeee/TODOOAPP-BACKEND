import type {
  AuthMailer,
  BackgroundRunner,
  EmailCooldown,
  IdentityAdmin,
  ProfileDirectory,
} from "./ports.js";

export function createRequestLoginCode(deps: {
  identityAdmin: IdentityAdmin;
  profileDirectory: ProfileDirectory;
  mailer: AuthMailer;
  emailCooldown: EmailCooldown;
  runInBackground: BackgroundRunner;
}) {
  return (input: { email: string }): void => {
    deps.runInBackground(async () => {
      const acquired = await deps.emailCooldown.tryAcquire("login", input.email);
      if (!acquired) {
        return;
      }
      const userId = await deps.profileDirectory.findIdByEmail(input.email);
      if (userId === null) {
        return;
      }
      const result = await deps.identityAdmin.createLoginCode({ userId, email: input.email });
      if (result.status === "created") {
        await deps.mailer.sendLoginCode({ to: input.email, code: result.code });
      }
    });
  };
}
