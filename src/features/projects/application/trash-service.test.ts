import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { versionRepository } from "@/features/editor/infra/dexie-version-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import { plotBeatRepository } from "@/features/plot/infra/dexie-plot-beat-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { tagRepository } from "@/features/tags/infra/dexie-tag-repository";

import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";

import { emptyTrash, purgeTrashItem } from "./trash-service";

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    [
      db.projects,
      db.chapters,
      db.scenes,
      db.characters,
      db.locations,
      db.loreEntries,
      db.plotBeats,
      db.timelineEvents,
      db.notes,
      db.tags,
      db.snippets,
      db.versions,
    ],
    async () => {
      await Promise.all(
        [
          db.projects,
          db.chapters,
          db.scenes,
          db.characters,
          db.locations,
          db.loreEntries,
          db.plotBeats,
          db.timelineEvents,
          db.notes,
          db.tags,
          db.snippets,
          db.versions,
        ].map((table) => table.clear()),
      );
    },
  );
});

async function seedProject(): Promise<string> {
  const project = await projectRepository.create({
    title: "Romance",
    status: "draft",
  });
  return project.id;
}

describe("purgeTrashItem", () => {
  it("purges a chapter with its scenes (active and trashed) and versions", async () => {
    const projectId = await seedProject();
    const chapter = await chapterRepository.create({ projectId });
    const activeScene = await sceneRepository.create({
      chapterId: chapter.id,
      title: "Cena ativa",
    });
    const trashedScene = await sceneRepository.create({
      chapterId: chapter.id,
      title: "Cena na lixeira",
    });
    await sceneRepository.softDelete(trashedScene.id);
    await versionRepository.create({
      entityType: "chapter",
      entityId: chapter.id,
      snapshot: {},
      auto: false,
    });

    await purgeTrashItem("chapter", chapter.id);

    expect(await chapterRepository.getById(chapter.id)).toBeUndefined();
    expect(await sceneRepository.getById(activeScene.id)).toBeUndefined();
    expect(await sceneRepository.getById(trashedScene.id)).toBeUndefined();
    expect(await sceneRepository.listDeleted()).toHaveLength(0);
    expect(await versionRepository.listByEntity(chapter.id)).toHaveLength(0);
    // The parent project is untouched.
    expect(await projectRepository.getById(projectId)).toBeDefined();
  });

  it("purges a project with its whole content tree (active and trashed)", async () => {
    const projectId = await seedProject();
    const activeChapter = await chapterRepository.create({ projectId });
    const trashedChapter = await chapterRepository.create({ projectId });
    await chapterRepository.softDelete(trashedChapter.id);
    const character = await characterRepository.create({
      projectId,
      name: "Davi",
    });
    await characterRepository.softDelete(character.id);
    const note = await noteRepository.create({ projectId, title: "Rascunho" });
    await plotBeatRepository.create({
      projectId,
      structure: "three_acts",
      title: "Ato I",
    });
    const trashedBeat = await plotBeatRepository.create({
      projectId,
      structure: "three_acts",
      title: "Ato II",
    });
    await plotBeatRepository.softDelete(trashedBeat.id);
    const tag = await tagRepository.create({ projectId, name: "arco" });
    await getDatabase().snippets.add({
      id: "snippet-1",
      projectId,
      title: "Trecho",
      content: "Era uma vez",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await purgeTrashItem("project", projectId);

    expect(await projectRepository.getById(projectId)).toBeUndefined();
    expect(await chapterRepository.getById(activeChapter.id)).toBeUndefined();
    expect(await chapterRepository.getById(trashedChapter.id)).toBeUndefined();
    expect(await characterRepository.getById(character.id)).toBeUndefined();
    expect(await noteRepository.getById(note.id)).toBeUndefined();
    expect(await plotBeatRepository.listByProject(projectId)).toHaveLength(0);
    expect(await plotBeatRepository.listDeleted()).toHaveLength(0);
    expect(await chapterRepository.listDeleted()).toHaveLength(0);
    expect(await characterRepository.listDeleted()).toHaveLength(0);
    // Tags and snippets are project-scoped and must be cascaded too.
    expect(await tagRepository.getById(tag.id)).toBeUndefined();
    expect(await tagRepository.listByProject(projectId)).toHaveLength(0);
    expect(
      await getDatabase().snippets.where("projectId").equals(projectId).count(),
    ).toBe(0);
  });

  it("purges a single note without touching the rest of the project", async () => {
    const projectId = await seedProject();
    const kept = await noteRepository.create({ projectId, title: "Manter" });
    const trashed = await noteRepository.create({ projectId, title: "Apagar" });
    await noteRepository.softDelete(trashed.id);

    await purgeTrashItem("note", trashed.id);

    expect(await noteRepository.getById(trashed.id)).toBeUndefined();
    expect(await noteRepository.getById(kept.id)).toBeDefined();
    expect(await projectRepository.getById(projectId)).toBeDefined();
  });
});

describe("emptyTrash", () => {
  it("purges everything in the trash, cascading active content of trashed projects", async () => {
    // Trashed project with an active chapter inside (cascade required).
    const trashedProject = await projectRepository.create({
      title: "Projeto Apagado",
      status: "draft",
    });
    const activeChapter = await chapterRepository.create({
      projectId: trashedProject.id,
    });
    await projectRepository.softDelete(trashedProject.id);

    // A healthy project that must survive.
    const healthyProject = await projectRepository.create({
      title: "Projeto Vivo",
      status: "draft",
    });
    const healthyChapter = await chapterRepository.create({
      projectId: healthyProject.id,
    });

    // Loose trashed rows in other tables.
    const trashedNote = await noteRepository.create({
      projectId: healthyProject.id,
      title: "Nota na lixeira",
    });
    await noteRepository.softDelete(trashedNote.id);
    const trashedBeat = await plotBeatRepository.create({
      projectId: healthyProject.id,
      structure: "three_acts",
      title: "Beat na lixeira",
    });
    await plotBeatRepository.softDelete(trashedBeat.id);

    await emptyTrash();

    expect(await projectRepository.listDeleted()).toHaveLength(0);
    expect(await chapterRepository.listDeleted()).toHaveLength(0);
    expect(await noteRepository.listDeleted()).toHaveLength(0);
    expect(await plotBeatRepository.listDeleted()).toHaveLength(0);
    // Cascade removed the active chapter inside the trashed project.
    expect(await chapterRepository.getById(activeChapter.id)).toBeUndefined();
    // Healthy project and its chapter remain.
    expect(await projectRepository.getById(healthyProject.id)).toBeDefined();
    expect(await chapterRepository.getById(healthyChapter.id)).toBeDefined();
  });
});
