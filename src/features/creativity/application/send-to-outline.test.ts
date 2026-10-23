import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { DexieChapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import { getDatabase } from "@/infra/db";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { DexieSceneRepository } from "@/features/plot/infra/dexie-scene-repository";

import { composeSceneSummary, sendSceneToOutline } from "./send-to-outline";

const sceneRepository = new DexieSceneRepository();
const projectRepository = new DexieProjectRepository();
const chapterRepository = new DexieChapterRepository();

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
      db.ideaCards,
    ],
    async () => {
      await Promise.all(
        [
          db.projects,
          db.chapters,
          db.scenes,
          db.characters,
          db.locations,
          db.ideaCards,
        ].map((table) => table.clear()),
      );
    },
  );
});

async function seedChapter() {
  const project = await projectRepository.create({
    title: "Romance",
    status: "draft",
  });
  const chapter = await chapterRepository.create({ projectId: project.id });
  return { project, chapter };
}

describe("composeSceneSummary", () => {
  it("joins the filled axes one per line", () => {
    expect(
      composeSceneSummary({
        goal: " Fugir do castelo ",
        conflict: "Guardas no portão",
        turn: "Túnel secreto",
      }),
    ).toBe(
      "Objetivo: Fugir do castelo\nConflito: Guardas no portão\nVirada: Túnel secreto",
    );
  });

  it("skips blank axes and returns undefined when all blank", () => {
    expect(composeSceneSummary({ goal: "A", conflict: "", turn: "B" })).toBe(
      "Objetivo: A\nVirada: B",
    );
    expect(composeSceneSummary({})).toBeUndefined();
    expect(composeSceneSummary({ goal: "   " })).toBeUndefined();
  });
});

describe("sendSceneToOutline", () => {
  it("creates the scene at the end of the chapter with pov and location", async () => {
    const { project, chapter } = await seedChapter();
    await sceneRepository.create({ chapterId: chapter.id, title: "Existente" });
    const character = await characterRepository.create({
      projectId: project.id,
      name: "Davi",
    });
    const location = await locationRepository.create({
      projectId: project.id,
      name: "Castelo",
    });

    const scene = await sendSceneToOutline({
      chapterId: chapter.id,
      title: "Perseguição",
      summary: "Objetivo: Fugir",
      povCharacterId: character.id,
      locationId: location.id,
    });

    expect(scene.title).toBe("Perseguição");
    expect(scene.order).toBe(2);
    expect(scene.summary).toBe("Objetivo: Fugir");
    expect(scene.povCharacterId).toBe(character.id);
    expect(scene.locationId).toBe(location.id);

    const persisted = await sceneRepository.getById(scene.id);
    expect(persisted?.chapterId).toBe(chapter.id);
    expect(persisted?.povCharacterId).toBe(character.id);
  });
});
