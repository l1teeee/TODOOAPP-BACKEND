import type { preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import type { HttpServer } from "../../../http/http-server.js";
import { getProfile } from "../../application/get-profile.js";
import type { ProfileRepository } from "../../application/ports.js";
import { updateProfile } from "../../application/update-profile.js";
import { currentUser } from "./require-user.js";

const profileSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  timezone: z.string(),
  emailNotifications: z.boolean(),
});
const timezones = new Set(Intl.supportedValuesOf("timeZone"));
const patchSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    timezone: z
      .string()
      .refine((value) => timezones.has(value), "Unsupported timezone")
      .optional(),
    emailNotifications: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export function registerMeRoutes(
  server: HttpServer,
  deps: { profiles: ProfileRepository; requireUser: preHandlerAsyncHookHandler },
): void {
  server.get(
    "/me",
    {
      preHandler: deps.requireUser,
      schema: { security: [{ bearerAuth: [] }], response: { 200: profileSchema } },
    },
    (request) => getProfile(deps.profiles, currentUser(request).id),
  );

  server.patch(
    "/me",
    {
      preHandler: deps.requireUser,
      schema: {
        security: [{ bearerAuth: [] }],
        body: patchSchema,
        response: { 200: profileSchema },
      },
    },
    (request) => updateProfile(deps.profiles, currentUser(request).id, request.body),
  );
}
