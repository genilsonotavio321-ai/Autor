import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DexieNoteRepository } from "./dexie-note-repository";

const repository = new DexieNoteRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.projects, db.notes, async () => {
    await db.projects.clear();
    await db.notes.clear();
  });
});

describe("DexieNoteRepository", () => {
  it("creates notes with defaults and sorts pinned first", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });

    const regular = await repository.create({
      projectId: project.id,
      title: "Ideia solta",
    });
    const pinned = await repository.create({
      projectId: project.id,
      title: "Importante",
      content: "Detalhe",
    });
    await repository.togglePinned(pinned.id, true);

    const list = await repository.listByProject(project.id);
    expect(list.map((note) => note.id)).toEqual([pinned.id, regular.id]);
    expect(list[0]?.pinned).toBe(true);
    expect(list[0]?.content).toBe("Detalhe");
  });

  it("defaults title when missing", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const note = await repository.create({ projectId: project.id });
    expect(note.title).toBe("Sem título");
    expect(note.pinned).toBe(false);
  });

  it("soft-deletes, lists trash and restores", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const note = await repository.create({
      projectId: project.id,
      title: "Rascunho",
    });

    await repository.softDelete(note.id);
    expect(await repository.listByProject(project.id)).toHaveLength(0);
    expect(await repository.listDeleted()).toHaveLength(1);

    await repository.restore(note.id);
    expect(await repository.listByProject(project.id)).toHaveLength(1);
    expect(await repository.listDeleted()).toHaveLength(0);
  });

  it("assigns sequential order on create, ignoring soft-deleted notes", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const first = await repository.create({ projectId: project.id });
    const second = await repository.create({ projectId: project.id });
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);

    // The soft-deleted max order must not be counted (chapter bug avoided).
    await repository.softDelete(second.id);
    const third = await repository.create({ projectId: project.id });
    expect(third.order).toBe(1);
  });

  it("backfills missing orders lazily on listByProject and persists them", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const now = new Date().toISOString();
    // Simulate legacy rows created before `order` existed.
    await getDatabase().notes.bulkAdd([
      {
        id: "legacy-1",
        projectId: project.id,
        title: "Antiga A",
        content: "",
        pinned: false,
        tags: [],
        createdAt: now,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "legacy-2",
        projectId: project.id,
        title: "Antiga B",
        content: "",
        pinned: false,
        tags: [],
        createdAt: now,
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const list = await repository.listByProject(project.id);
    expect(list.map((note) => note.id)).toEqual(["legacy-2", "legacy-1"]);
    expect(list[0]?.order).toBe(0);
    expect(list[1]?.order).toBe(1);

    // Orders were persisted, not just assigned in memory.
    const stored = await getDatabase().notes.get("legacy-1");
    expect(stored?.order).toBe(1);
  });

  it("applies moves atomically and bumps updatedAt", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const a = await repository.create({ projectId: project.id, title: "A" });
    const b = await repository.create({ projectId: project.id, title: "B" });
    const c = await repository.create({ projectId: project.id, title: "C" });

    const before = (await repository.getById(c.id))?.updatedAt;
    await repository.applyMoves([
      { id: c.id, order: 0 },
      { id: a.id, order: 2 },
    ]);

    const list = await repository.listByProject(project.id);
    expect(list.map((note) => note.id)).toEqual([c.id, b.id, a.id]);
    const after = await repository.getById(c.id);
    expect((after?.updatedAt ?? "") >= (before ?? "")).toBe(true);
  });

  it("soft-deletes the whole project and restores many at once", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const other = await projectRepository.create({
      title: "Outro",
      status: "draft",
    });
    const one = await repository.create({ projectId: project.id, title: "Um" });
    const two = await repository.create({ projectId: project.id, title: "Dois" });
    const untouched = await repository.create({
      projectId: other.id,
      title: "De outro projeto",
    });

    const ids = await repository.softDeleteByProject(project.id);
    expect(ids.sort()).toEqual([one.id, two.id].sort());
    expect(await repository.listByProject(project.id)).toHaveLength(0);
    expect(await repository.listByProject(other.id)).toHaveLength(1);
    expect(await repository.listDeleted()).toHaveLength(2);

    await repository.restoreMany(ids);
    expect(await repository.listByProject(project.id)).toHaveLength(2);
    expect(await repository.listDeleted()).toHaveLength(0);
    expect((await repository.getById(untouched.id))?.deletedAt).toBeUndefined();
  });
});
