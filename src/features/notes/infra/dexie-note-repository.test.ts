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
});
