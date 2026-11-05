import type { AuthenticatedUser } from "../domain/authenticated-user.js";
import type { Profile } from "../domain/profile.js";

export interface AccessTokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

export interface ProfilePatch {
  displayName?: string | null;
  timezone?: string;
  emailNotifications?: boolean;
}

export interface ProfileRepository {
  ensure(user: AuthenticatedUser): Promise<{ created: boolean }>;
  findById(id: string): Promise<Profile | null>;
  update(id: string, patch: ProfilePatch): Promise<Profile | null>;
}
