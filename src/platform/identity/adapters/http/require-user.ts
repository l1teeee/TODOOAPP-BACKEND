import type { FastifyBaseLogger, FastifyRequest, onRequestAsyncHookHandler } from "fastify";
import { USER_PROFILE_CREATED } from "../../../events/event-bus.js";
import type { EventBus } from "../../../events/event-bus.js";
import { missingToken } from "../../application/identity-errors.js";
import type { AccessTokenVerifier, ProfileRepository } from "../../application/ports.js";
import type { AuthenticatedUser } from "../../domain/authenticated-user.js";
import { createRecentlyEnsuredUsers } from "./recently-ensured-users.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

const ENSURED_TTL_MS = 10 * 60 * 1000;
const MAX_ENSURED_USERS = 10_000;

export function createRequireUser(deps: {
  verifier: AccessTokenVerifier;
  profiles: ProfileRepository;
  events: EventBus;
  logger: FastifyBaseLogger;
}): onRequestAsyncHookHandler {
  const ensuredUsers = createRecentlyEnsuredUsers({
    ttlMs: ENSURED_TTL_MS,
    maxEntries: MAX_ENSURED_USERS,
  });

  return async (request) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? "");
    const token = match?.[1];
    if (!token) {
      throw missingToken();
    }
    const user = await deps.verifier.verify(token);
    if (!ensuredUsers.has(user.id)) {
      const { created } = await deps.profiles.ensure(user);
      if (created) {
        await deps.events.publish({
          type: USER_PROFILE_CREATED,
          occurredAt: new Date().toISOString(),
          payload: { userId: user.id, email: user.email },
        });
        deps.logger.debug({ userId: user.id }, "User profile created");
      }
      ensuredUsers.remember(user.id);
    }
    request.user = user;
  };
}

export function currentUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) {
    throw missingToken();
  }
  return request.user;
}
