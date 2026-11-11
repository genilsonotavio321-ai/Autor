import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieChapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DexieSceneRepository } from "./dexie-scene-repository";

const repository = new DexieSceneRepository();
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

async function seed() {
  const project = await projectRepository.create({
    title: "Romance",
    status: "draft",
  });
  const chapterA = await chapterRepository.create({ projectId: project.id });
  const chapterB = await chapterRepository.create({ projectId: project.id });
  return { project, chapterA, chapterB };
}

describe("DexieSceneRepository", () => {
  it("creates scenes with sequential order and defaults", async () => {
    const { chapterA } = await seed();

    const first = await repository.create({ chapterId: chapterA.id });
    const second = await repository.create({
      chapterId: chapterA.id,
      title: "Confronto",
      status: "draft",
    });

    expect(first.title).toBe("Cena 1");
    expect(first.order).toBe(1);
    expect(first.status).toBe("todo");
    expect(second.order).toBe(2);
    expect(second.title).toBe("Confronto");
    expect(second.status).toBe("draft");
  });

  it("lists scenes per chapter and per project (joined via chapters)", async () => {
    const { project, chapterA, chapterB } = await seed();
    const s1 = await repository.create({ chapterId: chapterA.id });
    const s2 = await repository.create({ chapterId: chapterB.id });
    const s3 = await repository.create({ chapterId: chapterA.id });

    expect(
      (await repository.listByChapter(chapterA.id)).map((s) => s.id),
    ).toEqual([s1.id, s3.id]);

    const byProject = await repository.listByProject(project.id);
    expect(byProject.map((s) => s.id)).toEqual([s1.id, s3.id, s2.id]);

    await chapterRepository.softDelete(chapterB.id);
    expect(
      (await repository.listByProject(project.id)).map((s) => s.id),
    ).toEqual([s1.id, s3.id]);
  });

  it("applies cross-chapter moves in one batch", async () => {
    const { chapterA, chapterB } = await seed();
    const s1 = await repository.create({ chapterId: chapterA.id });
    const s2 = await repository.create({ chapterId: chapterA.id });
    const s3 = await repository.create({ chapterId: chapterB.id });

    const current = new Map([
      [chapterA.id, await repository.listByChapter(chapterA.id)],
      [chapterB.id, await repository.listByChapter(chapterB.id)],
    ]);
    const { computeSceneMove } = await import("../domain/ordering");
    await repository.applyMoves(
      computeSceneMove(current, s2.id, chapterB.id, 1),
    );

    expect(
      (await repository.listByChapter(chapterA.id)).map((s) => s.id),
    ).toEqual([s1.id]);
    expect(
      (await repository.listByChapter(chapterB.id)).map((s) => s.id),
    ).toEqual([s3.id, s2.id]);
    const moved = await repository.getById(s2.id);
    expect(moved?.chapterId).toBe(chapterB.id);
  });

  it("soft-deletes, lists trash and restores", async () => {
    const { chapterA } = await seed();
    const scene = await repository.create({ chapterId: chapterA.id });

    await repository.softDelete(scene.id);
    expect(await repository.listByChapter(chapterA.id)).toHaveLength(0);

    const deleted = await repository.listDeleted();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.id).toBe(scene.id);

    await repository.restore(scene.id);
    expect(await repository.listDeleted()).toEqual([]);
    expect(await repository.listByChapter(chapterA.id)).toHaveLength(1);
    const restored = await repository.getById(scene.id);
    expect(restored?.deletedAt).toBeUndefined();
  });
});
