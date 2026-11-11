import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { countDocWords } from "@/features/editor/domain/word-count";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import type { Json } from "@/shared/types/database";

import { renameMentionsInProject } from "./rename-mentions-service";

function docWithText(text: string): Json {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.projects, db.chapters, db.scenes, async () => {
    await db.projects.clear();
    await db.chapters.clear();
    await db.scenes.clear();
  });
});

describe("renameMentionsInProject", () => {
  it("rewrites chapters and scenes, recalculating chapter word counts", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const chapter = await chapterRepository.create({
      projectId: project.id,
      title: "Capítulo 1",
      content: docWithText("Davi chegou."),
    });
    const scene = await sceneRepository.create({
      chapterId: chapter.id,
      title: "Cena 1",
    });
    await sceneRepository.update(scene.id, {
      content: docWithText("Davi saiu."),
    });

    const count = await renameMentionsInProject(project.id, "Davi", "Davi Silva");

    expect(count).toBe(2);
    const updatedChapter = await chapterRepository.getById(chapter.id);
    expect(updatedChapter?.content).toEqual(docWithText("Davi Silva chegou."));
    expect(updatedChapter?.wordCount).toBe(
      countDocWords(docWithText("Davi Silva chegou.")),
    );
    const updatedScene = await sceneRepository.getById(scene.id);
    expect(updatedScene?.content).toEqual(docWithText("Davi Silva saiu."));
  });

  it("leaves other projects untouched", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const other = await projectRepository.create({
      title: "Outro",
      status: "draft",
    });
    await chapterRepository.create({
      projectId: project.id,
      title: "Alvo",
      content: docWithText("Davi chegou."),
    });
    const untouched = await chapterRepository.create({
      projectId: other.id,
      title: "Intocada",
      content: docWithText("Davi chegou."),
    });

    await renameMentionsInProject(project.id, "Davi", "Davi Silva");

    const kept = await chapterRepository.getById(untouched.id);
    expect(kept?.content).toEqual(docWithText("Davi chegou."));
  });

  it("returns zero when the old name is short or unchanged", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    await chapterRepository.create({
      projectId: project.id,
      title: "Capítulo 1",
      content: docWithText("Al chegou."),
    });

    expect(await renameMentionsInProject(project.id, "A", "Alberto")).toBe(0);
    expect(await renameMentionsInProject(project.id, "Al", "Al")).toBe(0);
  });
});
