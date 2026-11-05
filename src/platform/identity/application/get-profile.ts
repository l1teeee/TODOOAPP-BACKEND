import { AppError } from "../../errors/app-error.js";
import type { Profile } from "../domain/profile.js";
import type { ProfileRepository } from "./ports.js";

export async function getProfile(profiles: ProfileRepository, id: string): Promise<Profile> {
  const profile = await profiles.findById(id);
  if (!profile) {
    throw new AppError("not_found", "PROFILE_NOT_FOUND", "Profile not found");
  }
  return profile;
}
