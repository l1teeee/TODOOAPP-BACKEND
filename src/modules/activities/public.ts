import type { SQL } from "drizzle-orm";
import type { z } from "zod";
import type { DbExecutor } from "../../platform/db/database.js";
import type { AppModule } from "../../platform/modules/app-module.js";
import type { ActivityKind } from "./domain/activity.js";

export interface ActivityViewExtension<T> {
  // Names the additional response field without coupling core to its owner.
  readonly field: string;
  // Describes the response field for serialization and OpenAPI.
  readonly schema: z.ZodType<T>;
  // Supplies the response value when an activity has no association.
  readonly fallback: T;
  // Loads all requested activity values in one batched query.
  load(input: { userId: string; activityIds: readonly string[] }): Promise<ReadonlyMap<string, T>>;
}

export interface ActivityFilterExtension {
  // Names the satellite's optional list query parameter.
  readonly param: string;
  // Validates the query value and describes it in OpenAPI.
  readonly schema: z.ZodType<string>;
  // Adds a scoped SQL condition without per-row lookups.
  condition(input: { userId: string; value: string }): SQL;
}

export interface ActivityWriteExtension<T> {
  // Names the satellite's optional create and patch field.
  readonly field: string;
  // Validates writes at the HTTP boundary and describes them in OpenAPI.
  readonly schema: z.ZodType<T>;
  // Updates associations in the same transaction as the activity.
  apply(input: {
    executor: DbExecutor;
    userId: string;
    activityId: string;
    value: T;
  }): Promise<void>;
}

export interface ActivitiesExtensionPoints {
  // Registers an additional response field before routes are built.
  addView<T>(e: ActivityViewExtension<T>): void;
  // Registers an optional list condition before routes are built.
  addFilter(e: ActivityFilterExtension): void;
  // Registers a transactional write field before routes are built.
  addWrite<T>(e: ActivityWriteExtension<T>): void;
}

export interface ActivitySummary {
  // Identifies the owned activity for a satellite operation.
  id: string;
  // Lets satellites apply rules that depend on activity kind.
  kind: ActivityKind;
  // Provides a display label without exposing the entire entity.
  title: string;
}

export interface ActivityAccess {
  // Checks ownership and excludes trashed activities in one query.
  findOwned(input: { userId: string; activityId: string }): Promise<ActivitySummary | null>;
}

export interface ActivitiesModule {
  // Exposes route registration to the platform composition root.
  readonly module: AppModule;
  // Lets the composition root connect removable satellites.
  readonly extensions: ActivitiesExtensionPoints;
  // Lets satellites read owned summaries through a stable contract.
  readonly access: ActivityAccess;
}

// Lets satellites define cascading foreign keys and correlated filter conditions.
export { activities as activitiesTable } from "./adapters/persistence/schema.js";
// Shares the core vocabulary without exposing module internals.
export type { ActivityKind, ActivityStatus } from "./domain/activity.js";
