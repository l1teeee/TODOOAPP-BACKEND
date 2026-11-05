import { captchaFailed } from "../domain/auth-gateway-errors.js";
import type {
  AuthMailer,
  BackgroundRunner,
  EmailCooldown,
  HumanVerifier,
  IdentityAdmin,
} from "./ports.js";

export function createRegisterAccount(deps: {
  humanVerifier: HumanVerifier;
  identityAdmin: IdentityAdmin;
  mailer: AuthMailer;
  emailCooldown: EmailCooldown;
  runInBackground: BackgroundRunner;
}) {
  return async (input: {
    email: string;
    password: string;
    fullName: string;
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
      const result = await deps.identityAdmin.createSignupCode({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
      });
      if (result.status === "created") {
        await deps.mailer.sendSignupCode({
          to: input.email,
          fullName: input.fullName,
          code: result.code,
        });
      } else {
        await deps.mailer.sendAccountExists({ to: input.email });
      }
    });
  };
}
