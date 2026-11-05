export interface HumanVerifier {
  verify(input: { token: string; remoteIp: string }): Promise<boolean>;
}

export type SignupCodeResult =
  { status: "created"; code: string } | { status: "already_registered" };

export type RecoveryCodeResult = { status: "created"; code: string } | { status: "unknown_email" };

export interface IdentityAdmin {
  createSignupCode(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<SignupCodeResult>;
  createRecoveryCode(email: string): Promise<RecoveryCodeResult>;
}

export interface AuthMailer {
  sendSignupCode(input: { to: string; fullName: string; code: string }): Promise<void>;
  sendAccountExists(input: { to: string }): Promise<void>;
  sendRecoveryCode(input: { to: string; code: string }): Promise<void>;
}
