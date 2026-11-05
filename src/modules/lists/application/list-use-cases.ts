import type { List } from "../domain/list.js";
import { listLimitReached, listNotFound } from "../domain/list-errors.js";
import type { CreateListFields, ListPatch, ListRepository } from "./ports.js";

export function listLists(repository: ListRepository, userId: string): Promise<List[]> {
  return repository.list(userId);
}

export async function createList(
  repository: ListRepository,
  userId: string,
  input: CreateListFields,
): Promise<List> {
  if ((await repository.count(userId)) >= 200) {
    throw listLimitReached();
  }
  return repository.create(userId, input);
}

export async function updateList(
  repository: ListRepository,
  userId: string,
  id: string,
  patch: ListPatch,
): Promise<List> {
  const list = await repository.update(userId, id, patch);
  if (!list) {
    throw listNotFound();
  }
  return list;
}

export async function deleteList(
  repository: ListRepository,
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await repository.delete(userId, id);
  if (!deleted) {
    throw listNotFound();
  }
}
