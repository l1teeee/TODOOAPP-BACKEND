import type { Tag } from "../domain/tag.js";

export type TagFields = Pick<Tag, "name" | "color">;
export type TagPatch = Partial<TagFields>;

export interface TagRepository {
  list(userId: string): Promise<Tag[]>;
  count(userId: string): Promise<number>;
  create(userId: string, fields: TagFields): Promise<Tag>;
  update(userId: string, id: string, patch: TagPatch): Promise<Tag | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
