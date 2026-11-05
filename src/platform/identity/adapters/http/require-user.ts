import type { FastifyBaseLogger, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { AppError } from "../../../errors/app-error.js";
import { USER_PROFILE_CREATED } from "../../../events/event-bus.js";
import type { EventBus } from "../../../events/event-bus.js";
import type { AccessTokenVerifier, ProfileRepository } from "../../application/ports.js";
import type { AuthenticatedUser } from "../../domain/authenticated-user.js";

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
}): preHandlerAsyncHookHandler {
  const ensuredUsers = new Map<string, number>();

  return async (request) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? "");
    const token = match?.[1];
    if (!token) {
      throw new AppError("unauthorized", "MISSING_TOKEN", "Bearer token required");
    }
    const user = await deps.verifier.verify(token);
    const ensuredAt = ensuredUsers.get(user.id);
    if (ensuredAt === undefined || Date.now() - ensuredAt >= ENSURED_TTL_MS) {
      const { created } = await deps.profiles.ensure(user);
      if (created) {
        await deps.events.publish({
          type: USER_PROFILE_CREATED,
          occurredAt: new Date().toISOString(),
          payload: { userId: user.id, email: user.email },
        });
        deps.logger.debug({ userId: user.id }, "User profile created");
      }
      ensuredUsers.delete(user.id);
      if (ensuredUsers.size >= MAX_ENSURED_USERS) {
        const oldest = ensuredUsers.keys().next().value;
        if (oldest !== undefined) {
          ensuredUsers.delete(oldest);
        }
      }
      ensuredUsers.set(user.id, Date.now());
    }
    request.user = user;
  };
}

export function currentUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) {
    throw new AppError("unauthorized", "MISSING_TOKEN", "Bearer token required");
  }
  return request.user;
}
