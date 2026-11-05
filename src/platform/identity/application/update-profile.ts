import type { Profile } from "../domain/profile.js";
import { profileNotFound } from "./identity-errors.js";
import type { ProfilePatch, ProfileRepository } from "./ports.js";

export async function updateProfile(
  profiles: ProfileRepository,
  id: string,
  patch: ProfilePatch,
): Promise<Profile> {
  const profile = await profiles.update(id, patch);
  if (!profile) {
    throw profileNotFound();
  }
  return profile;
}
