import type { Profile } from "../domain/profile.js";
import { profileNotFound } from "./identity-errors.js";
import type { ProfileRepository } from "./ports.js";

export async function getProfile(profiles: ProfileRepository, id: string): Promise<Profile> {
  const profile = await profiles.findById(id);
  if (!profile) {
    throw profileNotFound();
  }
  return profile;
}
