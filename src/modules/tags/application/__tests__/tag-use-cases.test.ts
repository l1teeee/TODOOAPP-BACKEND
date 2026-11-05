import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { TagRepository } from "../ports.js";
import { createTag, updateTag, deleteTag } from "../tag-use-cases.js";

describe("tag use cases", () => {
  const list = jest.fn<TagRepository["list"]>();
  const count = jest.fn<TagRepository["count"]>();
  const create = jest.fn<TagRepository["create"]>();
  const update = jest.fn<TagRepository["update"]>();
  const remove = jest.fn<TagRepository["delete"]>();
  const repository: TagRepository = { list, count, create, update, delete: remove };
  const input = { name: "Tag", color: "blue" as const };
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it("rejects the limit without creating", async () => {
    count.mockResolvedValue(200);
    await expect(createTag(repository, "user", input)).rejects.toMatchObject({
      code: "TAG_LIMIT_REACHED",
    });
    expect(create).not.toHaveBeenCalled();
  });
  it("creates below the limit", async () => {
    const result = {
      ...input,
      id: "id",
      userId: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    count.mockResolvedValue(199);
    create.mockResolvedValue(result);
    await expect(createTag(repository, "user", input)).resolves.toEqual(result);
    expect(create).toHaveBeenCalledWith("user", input);
  });
  it("rejects missing updates and deletes", async () => {
    update.mockResolvedValue(null);
    remove.mockResolvedValue(false);
    await expect(updateTag(repository, "user", "id", {})).rejects.toMatchObject({
      code: "TAG_NOT_FOUND",
    });
    await expect(deleteTag(repository, "user", "id")).rejects.toMatchObject({
      code: "TAG_NOT_FOUND",
    });
  });
});
