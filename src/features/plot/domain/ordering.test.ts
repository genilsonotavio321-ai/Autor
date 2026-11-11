import { describe, expect, it } from "vitest";

import type { Chapter, Scene } from "@/shared/types/database";

import {
  computeChapterOrder,
  computeSceneMove,
  moveItem,
  renumber,
} from "./ordering";

function makeChapter(id: string, order: number): Chapter {
  return {
    id,
    projectId: "p1",
    title: id,
    order,
    status: "todo",
    wordCount: 0,
    content: { type: "doc", content: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeScene(id: string, chapterId: string, order: number): Scene {
  return {
    id,
    chapterId,
    title: id,
    order,
    content: { type: "doc", content: [] },
    status: "todo",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("moveItem", () => {
  it("moves an item without mutating the original", () => {
    const original = ["a", "b", "c"];
    expect(moveItem(original, 2, 0)).toEqual(["c", "a", "b"]);
    expect(original).toEqual(["a", "b", "c"]);
  });
});

describe("renumber", () => {
  it("numbers items from 1 preserving order", () => {
    expect(renumber([{ id: "x" }, { id: "y" }])).toEqual([
      { id: "x", order: 1 },
      { id: "y", order: 2 },
    ]);
  });
});

describe("computeChapterOrder", () => {
  const chapters = [makeChapter("c1", 1), makeChapter("c2", 2), makeChapter("c3", 3)];

  it("returns full renumbered list after a drag", () => {
    expect(computeChapterOrder(chapters, "c3", "c1")).toEqual([
      { id: "c3", order: 1 },
      { id: "c1", order: 2 },
      { id: "c2", order: 3 },
    ]);
  });

  it("returns empty when ids are unknown or unchanged", () => {
    expect(computeChapterOrder(chapters, "nope", "c1")).toEqual([]);
    expect(computeChapterOrder(chapters, "c1", "c1")).toEqual([]);
  });
});

describe("computeSceneMove", () => {
  it("reorders within the same chapter", () => {
    const map = new Map([
      ["ch1", [makeScene("s1", "ch1", 1), makeScene("s2", "ch1", 2), makeScene("s3", "ch1", 3)]],
    ]);

    const updates = computeSceneMove(map, "s3", "ch1", 0);

    expect(updates).toEqual([
      { id: "s3", chapterId: "ch1", order: 1 },
      { id: "s1", chapterId: "ch1", order: 2 },
      { id: "s2", chapterId: "ch1", order: 3 },
    ]);
  });

  it("moves a scene across chapters and renumbers both", () => {
    const map = new Map<string, Scene[]>([
      ["ch1", [makeScene("s1", "ch1", 1), makeScene("s2", "ch1", 2)]],
      ["ch2", [makeScene("s3", "ch2", 1)]],
    ]);

    const updates = computeSceneMove(map, "s2", "ch2", 1);

    const byChapter = (chapterId: string) =>
      updates
        .filter((update) => update.chapterId === chapterId)
        .sort((a, b) => a.order - b.order);

    expect(byChapter("ch1")).toEqual([
      { id: "s1", chapterId: "ch1", order: 1 },
    ]);
    expect(byChapter("ch2")).toEqual([
      { id: "s3", chapterId: "ch2", order: 1 },
      { id: "s2", chapterId: "ch2", order: 2 },
    ]);
  });

  it("returns empty for unknown scene", () => {
    const map = new Map([["ch1", [makeScene("s1", "ch1", 1)]]]);
    expect(computeSceneMove(map, "ghost", "ch1", 0)).toEqual([]);
  });
});
