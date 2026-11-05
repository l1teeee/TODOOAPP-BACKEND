import type { Activity, ActivityKind, ActivityStatus } from "../domain/activity.js";

export type ActivityFields = Omit<
  Activity,
  "id" | "userId" | "deletedAt" | "createdAt" | "updatedAt"
>;
export type CreateActivityFields = Pick<ActivityFields, "kind" | "title"> &
  Partial<Omit<ActivityFields, "kind" | "title" | "completedAt">>;
export type ActivityPatch = Partial<Omit<ActivityFields, "kind" | "completedAt">>;

export interface ActivityListQuery {
  from?: string;
  to?: string;
  unscheduled: boolean;
  kind?: ActivityKind;
  status?: ActivityStatus;
  q?: string;
  limit: number;
  extensionFilters: Readonly<Record<string, string>>;
}

export interface Page {
  cursor?: string;
  limit: number;
}

export interface PageResult {
  items: Activity[];
  nextCursor: string | null;
}

export interface ActivityRepository {
  create(
    userId: string,
    fields: ActivityFields,
    extensionValues: Readonly<Record<string, unknown>>,
  ): Promise<Activity>;
  update(
    userId: string,
    id: string,
    patch: ActivityPatch & { completedAt?: Date | null },
    extensionValues: Readonly<Record<string, unknown>>,
  ): Promise<Activity | null>;
  findOwned(userId: string, id: string): Promise<Activity | null>;
  list(userId: string, query: ActivityListQuery): Promise<Activity[]>;
  listCompleted(userId: string, page: Page): Promise<PageResult>;
  listTrashed(userId: string, page: Page): Promise<PageResult>;
  trash(userId: string, id: string): Promise<Activity | null>;
  restore(userId: string, id: string): Promise<Activity | null>;
  deleteForever(userId: string, id: string): Promise<"deleted" | "not_found" | "not_in_trash">;
}
