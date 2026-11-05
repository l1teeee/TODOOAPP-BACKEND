import { eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../../../db/database.js";
import type { ProfileRepository } from "../../application/ports.js";
import { profiles } from "./schema.js";

export function createDrizzleProfileRepository(db: DbExecutor): ProfileRepository {
  return {
    async ensure(user) {
      const [result] = await db
        .insert(profiles)
        .values({ id: user.id, email: user.email, displayName: user.fullName })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { email: sql`excluded.email`, updatedAt: sql`now()` },
          setWhere: sql`${profiles.email} is distinct from excluded.email`,
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)`.as("inserted") });
      return { created: result?.inserted === true };
    },
    async findById(id) {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
      return profile ?? null;
    },
    async update(id, patch) {
      const [profile] = await db
        .update(profiles)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(profiles.id, id))
        .returning();
      return profile ?? null;
    },
  };
}
