import type { List } from "../domain/list.js";

export type ListFields = Pick<List, "name" | "icon" | "position">;
export type CreateListFields = Pick<ListFields, "name" | "icon">;
export type ListPatch = Partial<ListFields>;

export interface ListRepository {
  list(userId: string): Promise<List[]>;
  count(userId: string): Promise<number>;
  create(userId: string, fields: CreateListFields): Promise<List>;
  update(userId: string, id: string, patch: ListPatch): Promise<List | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
