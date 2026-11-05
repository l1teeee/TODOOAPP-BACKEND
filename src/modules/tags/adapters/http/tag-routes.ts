import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import { currentUser } from "../../../../platform/identity/adapters/http/require-user.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import type { TagRepository } from "../../application/ports.js";
import { createTag, deleteTag, listTags, updateTag } from "../../application/tag-use-cases.js";
import { tagColors } from "../../domain/tag.js";

const fields = {
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,29}$/),
  color: z.enum(tagColors),
};
const tagSchema = z.object({ id: z.uuid(), ...fields });
const createSchema = z.strictObject(fields);
const patchSchema = createSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
const paramsSchema = z.strictObject({ id: z.uuid() });

export function registerTagRoutes(
  server: HttpServer,
  deps: { context: ModuleContext; repository: TagRepository },
): void {
  const { context, repository } = deps;
  const authenticated = { onRequest: [context.requireUser] };
  const metadata = { security: [{ bearerAuth: [] }], tags: ["tags"] };

  server.get(
    "/tags",
    {
      ...authenticated,
      schema: { ...metadata, response: { 200: z.object({ items: z.array(tagSchema) }) } },
    },
    async (request) => ({ items: await listTags(repository, currentUser(request).id) }),
  );

  server.post(
    "/tags",
    {
      ...authenticated,
      schema: { ...metadata, body: createSchema, response: { 201: tagSchema } },
    },
    async (request, reply) => {
      const tag = await createTag(repository, currentUser(request).id, request.body);
      return reply.code(201).send(tag);
    },
  );

  server.patch(
    "/tags/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: paramsSchema,
        body: patchSchema,
        response: { 200: tagSchema },
      },
    },
    (request) => updateTag(repository, currentUser(request).id, request.params.id, request.body),
  );

  server.delete(
    "/tags/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: paramsSchema,
        response: { 204: z.undefined().describe("Tag deleted") },
      },
    },
    async (request, reply) => {
      await deleteTag(repository, currentUser(request).id, request.params.id);
      return reply.code(204).send();
    },
  );
}
