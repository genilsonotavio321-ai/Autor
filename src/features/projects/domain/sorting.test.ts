import { describe, expect, it } from "vitest";

import type { Project } from "@/shared/types/database";

import { sortProjectEntries, type ProjectEntry } from "./sorting";

function entry(
  title: string,
  overrides: Partial<Project> = {},
  stats: Partial<Pick<ProjectEntry, "chapterCount" | "wordCount" | "readingMinutes">> = {},
): ProjectEntry {
  const project: Project = {
    id: title,
    title,
    status: "active",
    settings: {},
    createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
  return {
    project,
    chapterCount: stats.chapterCount ?? 1,
    wordCount: stats.wordCount ?? 100,
    readingMinutes: stats.readingMinutes ?? 1,
  };
}

const titles = (entries: ProjectEntry[]) => entries.map((e) => e.project.title);

describe("sortProjectEntries", () => {
  it("sorts by most recently updated first", () => {
    const entries = [
      entry("Antigo", { updatedAt: "2024-01-01T00:00:00.000Z" }),
      entry("Novo", { updatedAt: "2024-06-01T00:00:00.000Z" }),
    ];
    expect(titles(sortProjectEntries(entries, "updated-desc"))).toEqual([
      "Novo",
      "Antigo",
    ]);
  });

  it("sorts by creation date both ways", () => {
    const entries = [
      entry("B", { createdAt: "2024-02-01T00:00:00.000Z" }),
      entry("A", { createdAt: "2024-01-01T00:00:00.000Z" }),
    ];
    expect(titles(sortProjectEntries(entries, "created-asc"))).toEqual(["A", "B"]);
    expect(titles(sortProjectEntries(entries, "created-desc"))).toEqual(["B", "A"]);
  });

  it("sorts alphabetically, accent-insensitive", () => {
    const entries = [entry("Órbita"), entry("Água"), entry("Bola")];
    expect(titles(sortProjectEntries(entries, "title-asc"))).toEqual([
      "Água",
      "Bola",
      "Órbita",
    ]);
  });

  it("sorts by word count and reading time, descending", () => {
    const entries = [
      entry("Curto", {}, { wordCount: 50, readingMinutes: 1 }),
      entry("Longo", {}, { wordCount: 500, readingMinutes: 3 }),
    ];
    expect(titles(sortProjectEntries(entries, "words-desc"))).toEqual([
      "Longo",
      "Curto",
    ]);
    expect(titles(sortProjectEntries(entries, "reading-desc"))).toEqual([
      "Longo",
      "Curto",
    ]);
  });

  it("does not mutate the input array", () => {
    const entries = [entry("A"), entry("B")];
    const copy = [...entries];
    sortProjectEntries(entries, "title-asc");
    expect(entries).toEqual(copy);
  });
});
