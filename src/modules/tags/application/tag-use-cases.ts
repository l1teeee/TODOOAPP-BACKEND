import type { Tag } from "../domain/tag.js";
import { tagLimitReached, tagNotFound } from "../domain/tag-errors.js";
import type { TagFields, TagPatch, TagRepository } from "./ports.js";

export function listTags(repository: TagRepository, userId: string): Promise<Tag[]> {
  return repository.list(userId);
}

export async function createTag(
  repository: TagRepository,
  userId: string,
  input: TagFields,
): Promise<Tag> {
  if ((await repository.count(userId)) >= 200) {
    throw tagLimitReached();
  }
  return repository.create(userId, input);
}

export async function updateTag(
  repository: TagRepository,
  userId: string,
  id: string,
  patch: TagPatch,
): Promise<Tag> {
  const tag = await repository.update(userId, id, patch);
  if (!tag) {
    throw tagNotFound();
  }
  return tag;
}

export async function deleteTag(
  repository: TagRepository,
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await repository.delete(userId, id);
  if (!deleted) {
    throw tagNotFound();
  }
}
