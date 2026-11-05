import { captchaFailed } from "../domain/auth-gateway-errors.js";
import type {
  AuthMailer,
  BackgroundRunner,
  EmailCooldown,
  HumanVerifier,
  IdentityAdmin,
} from "./ports.js";

export function createRequestPasswordReset(deps: {
  humanVerifier: HumanVerifier;
  identityAdmin: IdentityAdmin;
  mailer: AuthMailer;
  emailCooldown: EmailCooldown;
  runInBackground: BackgroundRunner;
}) {
  return async (input: {
    email: string;
    turnstileToken: string;
    remoteIp: string;
  }): Promise<void> => {
    const verified = await deps.humanVerifier.verify({
      token: input.turnstileToken,
      remoteIp: input.remoteIp,
    });
    if (!verified) {
      throw captchaFailed();
    }
    deps.runInBackground(async () => {
      const acquired = await deps.emailCooldown.tryAcquire(input.email);
      if (!acquired) {
        return;
      }
      const result = await deps.identityAdmin.createRecoveryCode(input.email);
      if (result.status === "created") {
        await deps.mailer.sendRecoveryCode({ to: input.email, code: result.code });
      }
    });
  };
}
