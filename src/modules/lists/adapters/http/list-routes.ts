import { z } from "zod";
import type { HttpServer } from "../../../../platform/http/http-server.js";
import { currentUser } from "../../../../platform/identity/adapters/http/require-user.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import { createList, deleteList, listLists, updateList } from "../../application/list-use-cases.js";
import type { ListRepository } from "../../application/ports.js";

const fields = {
  name: z.string().trim().min(1).max(40),
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/),
  position: z.number().int().min(0).max(999),
};
const listSchema = z.object({ id: z.uuid(), ...fields, position: z.number().int().min(0) });
const createSchema = z.strictObject({ name: fields.name, icon: fields.icon });
const patchSchema = z
  .strictObject(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
const paramsSchema = z.strictObject({ id: z.uuid() });

export function registerListRoutes(
  server: HttpServer,
  deps: { context: ModuleContext; repository: ListRepository },
): void {
  const { context, repository } = deps;
  const authenticated = { onRequest: [context.requireUser] };
  const metadata = { security: [{ bearerAuth: [] }], tags: ["lists"] };

  server.get(
    "/lists",
    {
      ...authenticated,
      schema: { ...metadata, response: { 200: z.object({ items: z.array(listSchema) }) } },
    },
    async (request) => ({ items: await listLists(repository, currentUser(request).id) }),
  );

  server.post(
    "/lists",
    {
      ...authenticated,
      schema: { ...metadata, body: createSchema, response: { 201: listSchema } },
    },
    async (request, reply) => {
      const list = await createList(repository, currentUser(request).id, request.body);
      return reply.code(201).send(list);
    },
  );

  server.patch(
    "/lists/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: paramsSchema,
        body: patchSchema,
        response: { 200: listSchema },
      },
    },
    (request) => updateList(repository, currentUser(request).id, request.params.id, request.body),
  );

  server.delete(
    "/lists/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: paramsSchema,
        response: { 204: z.undefined().describe("List deleted") },
      },
    },
    async (request, reply) => {
      await deleteList(repository, currentUser(request).id, request.params.id);
      return reply.code(204).send();
    },
  );
}
