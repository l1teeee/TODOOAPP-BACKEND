import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { ListRepository } from "../ports.js";
import { createList, updateList, deleteList } from "../list-use-cases.js";

describe("list use cases", () => {
  const list = jest.fn<ListRepository["list"]>();
  const count = jest.fn<ListRepository["count"]>();
  const create = jest.fn<ListRepository["create"]>();
  const update = jest.fn<ListRepository["update"]>();
  const remove = jest.fn<ListRepository["delete"]>();
  const repository: ListRepository = { list, count, create, update, delete: remove };
  const input = { name: "List", icon: "icon" };
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it("rejects the limit without creating", async () => {
    count.mockResolvedValue(200);
    await expect(createList(repository, "user", input)).rejects.toMatchObject({
      code: "LIST_LIMIT_REACHED",
    });
    expect(create).not.toHaveBeenCalled();
  });
  it("creates below the limit", async () => {
    const result = {
      ...input,
      id: "id",
      userId: "user",
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    count.mockResolvedValue(199);
    create.mockResolvedValue(result);
    await expect(createList(repository, "user", input)).resolves.toEqual(result);
    expect(create).toHaveBeenCalledWith("user", input);
  });
  it("rejects missing updates and deletes", async () => {
    update.mockResolvedValue(null);
    remove.mockResolvedValue(false);
    await expect(updateList(repository, "user", "id", {})).rejects.toMatchObject({
      code: "LIST_NOT_FOUND",
    });
    await expect(deleteList(repository, "user", "id")).rejects.toMatchObject({
      code: "LIST_NOT_FOUND",
    });
  });
});
