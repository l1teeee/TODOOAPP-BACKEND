import { z } from "zod";
import type { ActivityPatch } from "../../application/ports.js";
import type { ExtensionRegistry } from "../../extension-points.js";

const dateSchema = z.iso.date().refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a real date in YYYY-MM-DD format");
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

const baseFields = {
  kind: z.enum(["habit", "reminder", "task"]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable(),
  status: z.enum(["todo", "in_progress", "completed"]),
  scheduledDate: dateSchema.nullable(),
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
  location: z.string().trim().max(120).nullable(),
  icon: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullable(),
};

export function createActivitySchemas(extensions: ExtensionRegistry) {
  const writeFields: Record<string, z.ZodType> = {};
  for (const extension of extensions.writes()) {
    writeFields[extension.field] = extension.schema.optional();
  }
  const filterFields: Record<string, z.ZodType<string | undefined>> = {};
  for (const extension of extensions.filters()) {
    filterFields[extension.param] = extension.schema.optional();
  }
  const viewFields: Record<string, z.ZodType> = {};
  for (const extension of extensions.views()) {
    viewFields[extension.field] = extension.schema;
  }
  const create = z
    .strictObject({ ...baseFields, ...writeFields })
    .partial()
    .required({ kind: true, title: true });
  const patch = z
    .strictObject(baseFields)
    .omit({ kind: true })
    .partial()
    .extend(writeFields)
    .refine((value) => Object.keys(value).length > 0, "At least one field is required");
  const list = z
    .strictObject({
      from: dateSchema.optional(),
      to: dateSchema.optional(),
      unscheduled: z.stringbool({ truthy: ["true"], falsy: ["false"] }).default(false),
      kind: baseFields.kind.optional(),
      status: baseFields.status.optional(),
      q: z.string().trim().min(1).max(100).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(300),
      ...filterFields,
    })
    .refine(
      (value) => (value.from === undefined) === (value.to === undefined),
      "Provide both from and to",
    )
    .refine(
      (value) => value.from === undefined || value.to === undefined || value.from <= value.to,
      "from must be on or before to",
    )
    .refine(
      (value) =>
        value.from === undefined ||
        value.to === undefined ||
        (Date.parse(value.to) - Date.parse(value.from)) / 86_400_000 + 1 <= 62,
      "Date range must span at most 62 days",
    );
  const page = z.strictObject({
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  });
  const activity = z.object({
    id: z.uuid(),
    userId: z.uuid(),
    ...baseFields,
    completedAt: z.iso.datetime().nullable(),
    deletedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    ...viewFields,
  });
  return {
    create,
    patch,
    list,
    page,
    activity,
    params: z.strictObject({ id: z.uuid() }),
    noContent: z.undefined().describe("Activity permanently deleted"),
    items: z.object({ items: z.array(activity) }),
    paginated: z.object({ items: z.array(activity), nextCursor: z.string().nullable() }),
  };
}

export function coreActivityPatch(body: ActivityPatch): ActivityPatch {
  const patch: ActivityPatch = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.status !== undefined) patch.status = body.status;
  if (body.scheduledDate !== undefined) patch.scheduledDate = body.scheduledDate;
  if (body.startTime !== undefined) patch.startTime = body.startTime;
  if (body.endTime !== undefined) patch.endTime = body.endTime;
  if (body.location !== undefined) patch.location = body.location;
  if (body.icon !== undefined) patch.icon = body.icon;
  return patch;
}

export function extensionWriteValues(
  body: object,
  extensions: ExtensionRegistry,
): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const extension of extensions.writes()) {
    if (Object.hasOwn(body, extension.field)) {
      values[extension.field] = Reflect.get(body, extension.field);
    }
  }
  return values;
}

export function extensionFilterValues(
  query: object,
  extensions: ExtensionRegistry,
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const extension of extensions.filters()) {
    const value: unknown = Reflect.get(query, extension.param);
    if (typeof value === "string") {
      values[extension.param] = value;
    }
  }
  return values;
}
