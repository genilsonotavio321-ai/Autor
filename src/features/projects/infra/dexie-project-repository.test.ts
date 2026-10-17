import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import { DexieProjectRepository } from "./dexie-project-repository";

const repository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.projects, db.settings, async () => {
    await db.projects.clear();
  });
});

describe("DexieProjectRepository", () => {
  it("creates a project with defaults", async () => {
    const project = await repository.create({
      title: "Meu romance",
      status: "draft",
    });

    expect(project.id).toBeTruthy();
    expect(project.title).toBe("Meu romance");
    expect(project.status).toBe("draft");
    expect(project.settings).toEqual({});
    expect(project.deletedAt).toBeUndefined();
    expect(project.createdAt).toBe(project.updatedAt);
  });

  it("lists active projects sorted by updatedAt descending", async () => {
    const first = await repository.create({ title: "A", status: "draft" });
    const second = await repository.create({ title: "B", status: "draft" });
    // Force distinct timestamps.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repository.update(first.id, { title: "A2" });

    const list = await repository.listActive();
    expect(list.map((project) => project.id)).toEqual([first.id, second.id]);
  });

  it("soft-deletes, lists trash and restores", async () => {
    const project = await repository.create({ title: "Excluir", status: "draft" });

    await repository.softDelete(project.id);
    expect(await repository.listActive()).toHaveLength(0);
    expect(await repository.listDeleted()).toHaveLength(1);

    await repository.restore(project.id);
    expect(await repository.listActive()).toHaveLength(1);
    expect(await repository.listDeleted()).toHaveLength(0);
    const restored = await repository.getById(project.id);
    expect(restored?.deletedAt).toBeUndefined();
  });

  it("persists lastEdit for resume writing", async () => {
    const project = await repository.create({ title: "Resume", status: "draft" });
    const lastEdit = {
      chapterId: "chapter-1",
      cursorOffset: 42,
      scrollY: 100,
      updatedAt: new Date().toISOString(),
    };

    await repository.updateLastEdit(project.id, lastEdit);
    const loaded = await repository.getById(project.id);

    expect(loaded?.lastEdit).toEqual(lastEdit);
  });

  it("throws when updating a missing project", async () => {
    await expect(repository.update("nope", { title: "X" })).rejects.toThrow();
  });
});
