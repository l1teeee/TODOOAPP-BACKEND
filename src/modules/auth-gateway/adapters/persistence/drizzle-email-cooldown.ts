import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type { EmailCooldown } from "../../application/ports.js";
import { authEmailCooldowns } from "./schema.js";

export function createDrizzleEmailCooldown(db: DbExecutor): EmailCooldown {
  return {
    async tryAcquire(purpose, email) {
      const emailHash = createHash("sha256")
        .update(`${purpose}:${email.trim().toLowerCase()}`)
        .digest("hex");
      const [acquired] = await db
        .insert(authEmailCooldowns)
        .values({ emailHash, lastSentAt: sql`now()` })
        .onConflictDoUpdate({
          target: authEmailCooldowns.emailHash,
          set: { lastSentAt: sql`now()` },
          setWhere: sql`${authEmailCooldowns.lastSentAt} < now() - interval '60 seconds'`,
        })
        .returning({ emailHash: authEmailCooldowns.emailHash });
      return acquired !== undefined;
    },
  };
}
