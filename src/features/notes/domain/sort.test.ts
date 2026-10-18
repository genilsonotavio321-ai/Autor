import { describe, expect, it } from "vitest";

import type { Note } from "@/shared/types/database";

import { NOTES_SORT_LABELS, sortNotes } from "./sort";

function note(overrides: Partial<Note> & { id: string }): Note {
  return {
    projectId: "p1",
    title: overrides.id,
    content: "",
    pinned: false,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sortNotes", () => {
  const a = note({
    id: "a",
    title: "Abelha",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  });
  const b = note({
    id: "b",
    title: "Beso",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
  });
  const c = note({
    id: "c",
    title: "Casa",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  });

  it("labels every mode in pt-BR", () => {
    expect(NOTES_SORT_LABELS.updated).toBe("Última atualizada");
    expect(NOTES_SORT_LABELS["created-desc"]).toBe("Mais recentes");
    expect(NOTES_SORT_LABELS["created-asc"]).toBe("Mais antigas");
    expect(NOTES_SORT_LABELS["title-asc"]).toBe("Título (A–Z)");
    expect(NOTES_SORT_LABELS["title-desc"]).toBe("Título (Z–A)");
    expect(NOTES_SORT_LABELS.manual).toBe("Ordem manual");
  });

  it("sorts by last update (default)", () => {
    expect(sortNotes([a, b, c], "updated").map((n) => n.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("sorts by creation, newest and oldest", () => {
    expect(sortNotes([a, b, c], "created-desc").map((n) => n.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortNotes([a, b, c], "created-asc").map((n) => n.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts by title A–Z and Z–A", () => {
    expect(sortNotes([a, b, c], "title-asc").map((n) => n.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortNotes([a, b, c], "title-desc").map((n) => n.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts manually by order, treating missing order as 0", () => {
    const list = [
      note({ id: "x", order: 2 }),
      note({ id: "y" }),
      note({ id: "z", order: 1 }),
    ];
    expect(sortNotes(list, "manual").map((n) => n.id)).toEqual(["y", "z", "x"]);
  });

  it("keeps pinned notes first in every mode", () => {
    const pinnedC = note({ id: "c", title: "Casa", pinned: true });
    for (const sort of [
      "updated",
      "created-desc",
      "created-asc",
      "title-asc",
      "title-desc",
      "manual",
    ] as const) {
      const sorted = sortNotes([a, b, pinnedC], sort);
      expect(sorted[0]?.id).toBe("c");
      expect(sorted.map((n) => n.pinned)).toEqual([true, false, false]);
    }
  });

  it("does not mutate the input array", () => {
    const input = [c, a, b];
    sortNotes(input, "title-asc");
    expect(input.map((n) => n.id)).toEqual(["c", "a", "b"]);
  });
});
