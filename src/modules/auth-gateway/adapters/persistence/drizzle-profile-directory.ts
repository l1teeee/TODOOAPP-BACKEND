import { eq } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import { profiles } from "../../../../platform/identity/adapters/persistence/schema.js";
import type { ProfileDirectory } from "../../application/ports.js";

export function createDrizzleProfileDirectory(db: DbExecutor): ProfileDirectory {
  return {
    async findIdByEmail(email) {
      const [profile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.email, email))
        .limit(1);
      return profile?.id ?? null;
    },
  };
}
