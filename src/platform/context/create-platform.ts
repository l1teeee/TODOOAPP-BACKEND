import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import { createDatabase } from "../db/database.js";
import type { Database } from "../db/database.js";
import { createEmailSender } from "../email/create-email-sender.js";
import { createInProcessEventBus } from "../events/event-bus.js";
import { createRequireUser } from "../identity/adapters/http/require-user.js";
import { createDrizzleProfileRepository } from "../identity/adapters/persistence/drizzle-profile-repository.js";
import { createSupabaseJwtVerifier } from "../identity/adapters/supabase-jwt-verifier.js";
import type { ModuleContext } from "../modules/app-module.js";

export function createPlatform(options: {
  config: AppConfig;
  env: NodeJS.ProcessEnv;
  logger: Logger;
}): { database: Database; context: ModuleContext } {
  const { config, env, logger } = options;
  const database = createDatabase(config.database, logger);
  const events = createInProcessEventBus(logger);
  const email = createEmailSender(config, logger);
  const verifier = createSupabaseJwtVerifier(config.supabase);
  const profiles = createDrizzleProfileRepository(database.db);
  const requireUser = createRequireUser({ verifier, profiles, events, logger });
  return {
    database,
    context: { config, env, logger, db: database.db, events, email, requireUser },
  };
}
