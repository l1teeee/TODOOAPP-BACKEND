import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import pino from "pino";
import { registerErrorHandling } from "../../../../http/error-handler.js";
import { USER_PROFILE_CREATED, type EventBus } from "../../../../events/event-bus.js";
import { invalidToken } from "../../../application/identity-errors.js";
import type { AccessTokenVerifier, ProfileRepository } from "../../../application/ports.js";
import { createRequireUser, currentUser } from "../require-user.js";

describe("require user", () => {
  const verify = jest.fn<AccessTokenVerifier["verify"]>();
  const ensure = jest.fn<ProfileRepository["ensure"]>();
  const findById = jest.fn<ProfileRepository["findById"]>();
  const update = jest.fn<ProfileRepository["update"]>();
  const publish = jest.fn<EventBus["publish"]>();
  const subscribe = jest.fn<EventBus["subscribe"]>();
  const user = { id: "user-1", email: "ana@example.com", fullName: null };
  let server: ReturnType<typeof makeServer>;
  function makeServer() {
    const instance = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    instance.setValidatorCompiler(validatorCompiler);
    instance.setSerializerCompiler(serializerCompiler);
    registerErrorHandling(instance);
    instance.get(
      "/",
      {
        onRequest: createRequireUser({
          verifier: { verify },
          profiles: { ensure, findById, update },
          events: { publish, subscribe },
          logger: pino({ level: "silent" }),
        }),
      },
      (request) => ({ id: currentUser(request).id }),
    );
    return instance;
  }
  beforeEach(() => {
    jest.resetAllMocks();
    verify.mockResolvedValue(user);
    ensure.mockResolvedValue({ created: false });
    publish.mockResolvedValue();
    server = makeServer();
  });
  afterEach(() => server.close());
  it.each([undefined, "Basic abc", "Bearer "])(
    "rejects missing or malformed header %s",
    async (authorization) => {
      const response = await server.inject({
        method: "GET",
        url: "/",
        headers: authorization === undefined ? {} : { authorization },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: "MISSING_TOKEN" } });
      expect(verify).not.toHaveBeenCalled();
    },
  );
  it("does not ensure a profile for an invalid token", async () => {
    verify.mockRejectedValue(invalidToken());
    const response = await server.inject({
      method: "GET",
      url: "/",
      headers: { authorization: "Bearer bad" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_TOKEN" } });
    expect(ensure).not.toHaveBeenCalled();
  });
  it("accepts lowercase bearer and publishes created profiles once", async () => {
    ensure.mockResolvedValue({ created: true });
    const response = await server.inject({
      method: "GET",
      url: "/",
      headers: { authorization: "bearer token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: user.id });
    expect(verify).toHaveBeenCalledWith("token");
    expect(publish).toHaveBeenCalledWith({
      type: USER_PROFILE_CREATED,
      occurredAt: expect.any(String),
      payload: { userId: user.id, email: user.email },
    });
    await server.inject({ method: "GET", url: "/", headers: { authorization: "Bearer token" } });
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it("ensures separate users and does not publish existing profiles", async () => {
    verify.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, id: "user-2" });
    await server.inject({ method: "GET", url: "/", headers: { authorization: "Bearer one" } });
    await server.inject({ method: "GET", url: "/", headers: { authorization: "Bearer two" } });
    expect(ensure).toHaveBeenCalledTimes(2);
    expect(publish).not.toHaveBeenCalled();
  });
});
