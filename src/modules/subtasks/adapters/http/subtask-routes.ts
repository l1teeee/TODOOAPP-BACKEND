import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import { currentUser } from "../../../../platform/identity/adapters/http/require-user.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import type { SubtaskUseCases } from "../../application/subtask-use-cases.js";
import { SUBTASK_TITLE_MAX } from "../../domain/subtask.js";

const titleSchema = z.string().trim().min(1).max(SUBTASK_TITLE_MAX);
const activityParams = z.strictObject({ activityId: z.uuid() });
const subtaskParams = z.strictObject({ id: z.uuid() });
const subtaskSchema = z.object({
  id: z.uuid(),
  activityId: z.uuid(),
  title: titleSchema,
  isDone: z.boolean(),
  position: z.number().int(),
});
const itemsSchema = z.object({ items: z.array(subtaskSchema) });
const batchSchema = z.strictObject({
  titles: z
    .array(titleSchema)
    .min(1)
    .max(10)
    .refine((titles) => new Set(titles).size === titles.length, "Titles must be unique"),
});
const patchSchema = z
  .strictObject({ title: titleSchema.optional(), isDone: z.boolean().optional() })
  .refine(
    (value) => value.title !== undefined || value.isDone !== undefined,
    "At least one field is required",
  );

export function registerSubtaskRoutes(
  server: HttpServer,
  context: ModuleContext,
  useCases: SubtaskUseCases,
): void {
  const authenticated = { onRequest: [context.requireUser] };
  const metadata = { security: [{ bearerAuth: [] }], tags: ["subtasks"] };

  server.get(
    "/activities/:activityId/subtasks",
    {
      ...authenticated,
      schema: { ...metadata, params: activityParams, response: { 200: itemsSchema } },
    },
    async (request) => ({
      items: await useCases.list(currentUser(request).id, request.params.activityId),
    }),
  );

  server.post(
    "/activities/:activityId/subtasks",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: activityParams,
        body: z.strictObject({ title: titleSchema }),
        response: { 201: subtaskSchema },
      },
    },
    async (request, reply) => {
      const item = await useCases.create(
        currentUser(request).id,
        request.params.activityId,
        request.body.title,
      );
      return reply.code(201).send(item);
    },
  );

  server.post(
    "/activities/:activityId/subtasks/batch",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: activityParams,
        body: batchSchema,
        response: { 201: itemsSchema },
      },
    },
    async (request, reply) => {
      const items = await useCases.createMany(
        currentUser(request).id,
        request.params.activityId,
        request.body.titles,
      );
      return reply.code(201).send({ items });
    },
  );

  server.patch(
    "/subtasks/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: subtaskParams,
        body: patchSchema,
        response: { 200: subtaskSchema },
      },
    },
    async (request) => useCases.update(currentUser(request).id, request.params.id, request.body),
  );

  server.delete(
    "/subtasks/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: subtaskParams,
        response: { 204: z.undefined().describe("Subtask deleted") },
      },
    },
    async (request, reply) => {
      await useCases.remove(currentUser(request).id, request.params.id);
      return reply.code(204).send();
    },
  );
}
