import type { FastifyBaseLogger } from "fastify";

export interface IntegrationEvent {
  type: string;
  occurredAt: string;
  payload: unknown;
}

export interface EventBus {
  publish(event: IntegrationEvent): Promise<void>;
  subscribe(type: string, handler: (event: IntegrationEvent) => Promise<void>): void;
}

// Payload: { userId: string; email: string }. Subscribers validate it independently.
export const USER_PROFILE_CREATED = "identity.user_profile_created";

export function createInProcessEventBus(logger: FastifyBaseLogger): EventBus {
  const handlers = new Map<string, ((event: IntegrationEvent) => Promise<void>)[]>();
  return {
    async publish(event) {
      for (const handler of handlers.get(event.type) ?? []) {
        try {
          await handler(event);
        } catch (error) {
          logger.error({ err: error, eventType: event.type }, "Event handler failed");
        }
      }
    },
    subscribe(type, handler) {
      const subscribers = handlers.get(type) ?? [];
      subscribers.push(handler);
      handlers.set(type, subscribers);
    },
  };
}
