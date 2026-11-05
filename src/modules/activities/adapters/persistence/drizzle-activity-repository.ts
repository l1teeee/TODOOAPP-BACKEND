import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Placeholder, SQL } from "drizzle-orm";
import type { DbExecutor } from "../../../../platform/db/database.js";
import type {
  ActivityListQuery,
  ActivityRepository,
  Page,
  PageResult,
} from "../../application/ports.js";
import type { Activity } from "../../domain/activity.js";
import { activityInvalid } from "../../domain/activity-errors.js";
import type { ExtensionRegistry } from "../../extension-points.js";
import { activities } from "./schema.js";

function presentRow(row: typeof activities.$inferSelect): Activity {
  return {
    ...row,
    startTime: row.startTime?.slice(0, 5) ?? null,
    endTime: row.endTime?.slice(0, 5) ?? null,
  };
}

function owned(userId: string | Placeholder, id: string | Placeholder): SQL {
  return sql`${activities.userId} = ${userId} and ${activities.id} = ${id}`;
}

function isPlainRangeQuery(
  query: ActivityListQuery,
  filters: ReturnType<ExtensionRegistry["filters"]>,
): boolean {
  return (
    !query.unscheduled &&
    query.from !== undefined &&
    query.to !== undefined &&
    query.kind === undefined &&
    query.status === undefined &&
    query.q === undefined &&
    filters.every((extension) => query.extensionFilters[extension.param] === undefined)
  );
}

interface Cursor {
  t: string;
  id: string;
}

function parseCursorPayload(value: string): unknown {
  let decoded: Buffer;
  let payload: unknown;
  try {
    decoded = Buffer.from(value, "base64url");
    payload = JSON.parse(decoded.toString("utf8"));
  } catch {
    throw activityInvalid("Invalid cursor");
  }
  if (decoded.toString("base64url") !== value) {
    throw activityInvalid("Invalid cursor");
  }
  return payload;
}

function assertValidTimestamp(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)) {
    throw activityInvalid("Invalid cursor");
  }
  const timestamp = new Date(value);
  if (
    !Number.isFinite(timestamp.getTime()) ||
    timestamp.getUTCFullYear() < 1 ||
    timestamp.getUTCFullYear() > 9999 ||
    timestamp.toISOString().slice(0, 19) !== value.slice(0, 19)
  ) {
    throw activityInvalid("Invalid cursor");
  }
}

function decodeCursor(value: string): Cursor {
  const cursor = parseCursorPayload(value);
  if (
    typeof cursor !== "object" ||
    cursor === null ||
    !("t" in cursor) ||
    !("id" in cursor) ||
    typeof cursor.t !== "string" ||
    typeof cursor.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)
  ) {
    throw activityInvalid("Invalid cursor");
  }
  assertValidTimestamp(cursor.t);
  return { t: cursor.t, id: cursor.id };
}

export function createDrizzleActivityRepository(
  db: DbExecutor,
  extensions: ExtensionRegistry,
): ActivityRepository {
  // Keep conditions and orderBy identical to the dynamic builder in list().
  const listRange = db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.userId, sql.placeholder("userId")),
        isNull(activities.deletedAt),
        sql`(${activities.kind} = 'habit' or ${activities.scheduledDate} between ${sql.placeholder("from")} and ${sql.placeholder("to")})`,
      ),
    )
    .orderBy(
      sql`${activities.scheduledDate} asc nulls first`,
      sql`${activities.startTime} asc nulls last`,
      desc(activities.createdAt),
    )
    .limit(sql.placeholder("limit"))
    .prepare("activities_list_range");
  const findOwned = db
    .select()
    .from(activities)
    .where(owned(sql.placeholder("userId"), sql.placeholder("id")))
    .prepare("activities_find_owned");

  async function applyWrites(
    tx: DbExecutor,
    userId: string,
    activityId: string,
    extensionValues: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    for (const extension of extensions.writes()) {
      if (Object.hasOwn(extensionValues, extension.field)) {
        await extension.apply({
          executor: tx,
          userId,
          activityId,
          value: extensionValues[extension.field],
        });
      }
    }
  }

  async function paginated(
    userId: string,
    page: Page,
    category: "completed" | "trash",
  ): Promise<PageResult> {
    const timestamp = category === "completed" ? activities.completedAt : activities.deletedAt;
    const conditions = [eq(activities.userId, userId)];
    if (category === "completed") {
      conditions.push(eq(activities.status, "completed"), isNull(activities.deletedAt));
    } else {
      conditions.push(isNotNull(activities.deletedAt));
    }
    if (page.cursor !== undefined) {
      const cursor = decodeCursor(page.cursor);
      conditions.push(
        sql`(${timestamp}, ${activities.id}) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)`,
      );
    }
    const rows = await db
      .select({
        activity: activities,
        // Preserve Postgres microseconds so equal-millisecond rows are not skipped between pages.
        cursorTime: sql<string>`to_char(${timestamp} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(activities)
      .where(and(...conditions))
      .orderBy(desc(timestamp), desc(activities.id))
      .limit(page.limit + 1);
    const visible = rows.slice(0, page.limit);
    const last = visible.at(-1);
    const nextCursor =
      rows.length > page.limit && last
        ? Buffer.from(JSON.stringify({ t: last.cursorTime, id: last.activity.id })).toString(
            "base64url",
          )
        : null;
    return { items: visible.map((row) => presentRow(row.activity)), nextCursor };
  }

  return {
    async create(userId, fields, extensionValues) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(activities)
          .values({ ...fields, userId })
          .returning();
        if (!row) {
          throw new Error("Activity insert returned no row");
        }
        await applyWrites(tx, userId, row.id, extensionValues);
        return presentRow(row);
      });
    },
    async update(userId, id, patch, extensionValues) {
      return db.transaction(async (tx) => {
        const incomingStatus = patch.status ?? activities.status;
        const [row] = await tx
          .update(activities)
          .set({
            ...patch,
            completedAt: sql`case
              when ${incomingStatus} = 'completed' and ${activities.status} <> 'completed' then now()
              when ${incomingStatus} <> 'completed' and ${activities.status} = 'completed' then null
              else ${activities.completedAt}
            end`,
            updatedAt: sql`now()`,
          })
          .where(and(owned(userId, id), isNull(activities.deletedAt)))
          .returning();
        if (!row) {
          return null;
        }
        await applyWrites(tx, userId, id, extensionValues);
        return presentRow(row);
      });
    },
    async findOwned(userId, id) {
      const [row] = await findOwned.execute({ userId, id });
      return row ? presentRow(row) : null;
    },
    async list(userId, query) {
      if (isPlainRangeQuery(query, extensions.filters())) {
        const rows = await listRange.execute({
          userId,
          from: query.from,
          to: query.to,
          limit: query.limit,
        });
        return rows.map(presentRow);
      }
      const conditions = [eq(activities.userId, userId), isNull(activities.deletedAt)];
      if (query.unscheduled) {
        conditions.push(isNull(activities.scheduledDate), ne(activities.kind, "habit"));
      } else if (query.from !== undefined && query.to !== undefined) {
        conditions.push(
          sql`(${activities.kind} = 'habit' or ${activities.scheduledDate} between ${query.from} and ${query.to})`,
        );
      }
      if (query.kind !== undefined) {
        conditions.push(eq(activities.kind, query.kind));
      }
      if (query.status !== undefined) {
        conditions.push(eq(activities.status, query.status));
      }
      if (query.q !== undefined) {
        const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
        conditions.push(
          sql`(${activities.title} ilike ${pattern} or ${activities.description} ilike ${pattern})`,
        );
      }
      for (const extension of extensions.filters()) {
        const value = query.extensionFilters[extension.param];
        if (value !== undefined) {
          conditions.push(extension.condition({ userId, value }));
        }
      }
      const rows = await db
        .select()
        .from(activities)
        .where(and(...conditions))
        .orderBy(
          sql`${activities.scheduledDate} asc nulls first`,
          sql`${activities.startTime} asc nulls last`,
          desc(activities.createdAt),
        )
        .limit(query.limit);
      return rows.map(presentRow);
    },
    listCompleted(userId, page) {
      return paginated(userId, page, "completed");
    },
    listTrashed(userId, page) {
      return paginated(userId, page, "trash");
    },
    async trash(userId, id) {
      const [row] = await db
        .update(activities)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(owned(userId, id), isNull(activities.deletedAt)))
        .returning();
      return row ? presentRow(row) : null;
    },
    async restore(userId, id) {
      const [row] = await db
        .update(activities)
        .set({ deletedAt: null, updatedAt: sql`now()` })
        .where(and(owned(userId, id), isNotNull(activities.deletedAt)))
        .returning();
      return row ? presentRow(row) : null;
    },
    async deleteForever(userId, id) {
      const deleted = db.$with("deleted_activity").as(
        db
          .delete(activities)
          .where(and(owned(userId, id), isNotNull(activities.deletedAt)))
          .returning({ id: activities.id }),
      );
      // Both reads share the statement snapshot, including the row removed by the CTE.
      const [result] = await db
        .with(deleted)
        .select({ deleted: sql<boolean>`exists (select 1 from ${deleted})` })
        .from(activities)
        .where(owned(userId, id));
      if (!result) {
        return "not_found";
      }
      return result.deleted ? "deleted" : "not_in_trash";
    },
  };
}
