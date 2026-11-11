import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieChapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { moveSceneToChapterEnd } from "./plot-service";
import { sceneRepository } from "../infra/dexie-scene-repository";

const projectRepository = new DexieProjectRepository();
const chapterRepository = new DexieChapterRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    db.projects,
    db.chapters,
    db.scenes,
    async () => {
      await db.projects.clear();
      await db.chapters.clear();
      await db.scenes.clear();
    },
  );
});

describe("moveSceneToChapterEnd", () => {
  it("moves the scene to the end of the target chapter", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const chapterA = await chapterRepository.create({ projectId: project.id });
    const chapterB = await chapterRepository.create({ projectId: project.id });
    const s1 = await sceneRepository.create({ chapterId: chapterA.id });
    const s2 = await sceneRepository.create({ chapterId: chapterA.id });
    const s3 = await sceneRepository.create({ chapterId: chapterB.id });

    await moveSceneToChapterEnd(s1.id, chapterB.id);

    expect(
      (await sceneRepository.listByChapter(chapterA.id)).map((s) => s.id),
    ).toEqual([s2.id]);
    expect(
      (await sceneRepository.listByChapter(chapterB.id)).map((s) => s.id),
    ).toEqual([s3.id, s1.id]);
  });

  it("re-appends within the same chapter when moving to its end", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const chapterA = await chapterRepository.create({ projectId: project.id });
    const s1 = await sceneRepository.create({ chapterId: chapterA.id });
    const s2 = await sceneRepository.create({ chapterId: chapterA.id });

    await moveSceneToChapterEnd(s1.id, chapterA.id);

    expect(
      (await sceneRepository.listByChapter(chapterA.id)).map((s) => s.id),
    ).toEqual([s2.id, s1.id]);
  });

  it("throws for unknown scene", async () => {
    await expect(moveSceneToChapterEnd("ghost", "ch")).rejects.toThrow(
      "Scene not found",
    );
  });
});
