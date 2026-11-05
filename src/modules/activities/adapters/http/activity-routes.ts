import type { HttpServer } from "../../../../platform/http/http-server.js";
import { currentUser } from "../../../../platform/identity/adapters/http/require-user.js";
import type { ModuleContext } from "../../../../platform/modules/app-module.js";
import {
  createActivity,
  deleteActivityForever,
  getActivity,
  listActivities,
  listCompletedActivities,
  listTrashedActivities,
  restoreActivity,
  trashActivity,
  updateActivity,
} from "../../application/activity-use-cases.js";
import type { ActivityRepository } from "../../application/ports.js";
import type { Activity } from "../../domain/activity.js";
import type { ExtensionRegistry } from "../../extension-points.js";
import type { createActivityPresenter } from "./activity-presenter.js";
import {
  coreActivityPatch,
  createActivitySchemas,
  extensionFilterValues,
  extensionWriteValues,
} from "./activity-schemas.js";

export function registerActivityRoutes(
  server: HttpServer,
  deps: {
    context: ModuleContext;
    repository: ActivityRepository;
    extensions: ExtensionRegistry;
    presentActivities: ReturnType<typeof createActivityPresenter>;
  },
): void {
  const { context, repository, extensions, presentActivities } = deps;
  extensions.freeze();
  const schemas = createActivitySchemas(extensions);
  const authenticated = { onRequest: [context.requireUser] };
  const metadata = { security: [{ bearerAuth: [] }], tags: ["activities"] };

  async function presentOne(userId: string, activity: Activity) {
    const [presented] = await presentActivities(userId, [activity]);
    if (!presented) {
      throw new Error("Activity presenter returned no activity");
    }
    return presented;
  }

  server.get(
    "/activities",
    {
      ...authenticated,
      schema: { ...metadata, querystring: schemas.list, response: { 200: schemas.items } },
    },
    async (request) => {
      const userId = currentUser(request).id;
      const items = await listActivities(repository, userId, {
        ...request.query,
        extensionFilters: extensionFilterValues(request.query, extensions),
      });
      return { items: await presentActivities(userId, items) };
    },
  );

  server.get(
    "/activities/completed",
    {
      ...authenticated,
      schema: { ...metadata, querystring: schemas.page, response: { 200: schemas.paginated } },
    },
    async (request) => {
      const userId = currentUser(request).id;
      const page = await listCompletedActivities(repository, userId, request.query);
      return { items: await presentActivities(userId, page.items), nextCursor: page.nextCursor };
    },
  );

  server.get(
    "/activities/trash",
    {
      ...authenticated,
      schema: { ...metadata, querystring: schemas.page, response: { 200: schemas.paginated } },
    },
    async (request) => {
      const userId = currentUser(request).id;
      const page = await listTrashedActivities(repository, userId, request.query);
      return { items: await presentActivities(userId, page.items), nextCursor: page.nextCursor };
    },
  );

  server.get(
    "/activities/:id",
    {
      ...authenticated,
      schema: { ...metadata, params: schemas.params, response: { 200: schemas.activity } },
    },
    async (request) => {
      const userId = currentUser(request).id;
      return presentOne(userId, await getActivity(repository, userId, request.params.id));
    },
  );

  server.post(
    "/activities",
    {
      ...authenticated,
      schema: { ...metadata, body: schemas.create, response: { 201: schemas.activity } },
    },
    async (request, reply) => {
      const userId = currentUser(request).id;
      const activity = await createActivity(
        repository,
        userId,
        request.body,
        extensionWriteValues(request.body, extensions),
      );
      return reply.code(201).send(await presentOne(userId, activity));
    },
  );

  server.patch(
    "/activities/:id",
    {
      ...authenticated,
      schema: {
        ...metadata,
        params: schemas.params,
        body: schemas.patch,
        response: { 200: schemas.activity },
      },
    },
    async (request) => {
      const userId = currentUser(request).id;
      const activity = await updateActivity(
        repository,
        userId,
        request.params.id,
        coreActivityPatch(request.body),
        extensionWriteValues(request.body, extensions),
      );
      return presentOne(userId, activity);
    },
  );

  server.post(
    "/activities/:id/trash",
    {
      ...authenticated,
      schema: { ...metadata, params: schemas.params, response: { 200: schemas.activity } },
    },
    async (request) => {
      const userId = currentUser(request).id;
      return presentOne(userId, await trashActivity(repository, userId, request.params.id));
    },
  );

  server.post(
    "/activities/:id/restore",
    {
      ...authenticated,
      schema: { ...metadata, params: schemas.params, response: { 200: schemas.activity } },
    },
    async (request) => {
      const userId = currentUser(request).id;
      return presentOne(userId, await restoreActivity(repository, userId, request.params.id));
    },
  );

  server.delete(
    "/activities/:id",
    {
      ...authenticated,
      schema: { ...metadata, params: schemas.params, response: { 204: schemas.noContent } },
    },
    async (request, reply) => {
      await deleteActivityForever(repository, currentUser(request).id, request.params.id);
      return reply.code(204).send();
    },
  );
}
