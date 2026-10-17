import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { countDocWords } from "@/features/editor/domain/word-count";
import { markdownToDoc } from "@/features/export/domain/markdown";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DexieChapterRepository } from "./dexie-chapter-repository";

const repository = new DexieChapterRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.chapters, db.projects, async () => {
    await db.chapters.clear();
    await db.projects.clear();
  });
});

async function seedProject(): Promise<string> {
  const project = await projectRepository.create({
    title: "Romance",
    status: "draft",
  });
  return project.id;
}

describe("DexieChapterRepository", () => {
  it("assigns incremental order and a default title", async () => {
    const projectId = await seedProject();
    const first = await repository.create({ projectId });
    const second = await repository.create({ projectId });
    expect(first.order).toBe(1);
    expect(first.title).toBe("Capítulo 1");
    expect(second.order).toBe(2);
  });

  it("creates a chapter with initial content and counts its words", async () => {
    const projectId = await seedProject();
    const content = markdownToDoc("# Capítulo importado\n\nEra uma vez.");
    const chapter = await repository.create({
      projectId,
      title: "Importado",
      content,
    });
    expect(chapter.title).toBe("Importado");
    expect(chapter.wordCount).toBe(countDocWords(content));
    expect(chapter.wordCount).toBeGreaterThan(0);
  });

  it("soft-deletes and restores a chapter", async () => {
    const projectId = await seedProject();
    const chapter = await repository.create({ projectId });
    await repository.softDelete(chapter.id);
    expect(await repository.listByProject(projectId)).toHaveLength(0);
    await repository.restore(chapter.id);
    expect(await repository.listByProject(projectId)).toHaveLength(1);
  });
});
