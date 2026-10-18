import type { ProjectsSort } from "@/shared/store/ui-store";
import type { Project } from "@/shared/types/database";

/** A project paired with its aggregate stats (used for sorting and display). */
export interface ProjectEntry {
  project: Project;
  chapterCount: number;
  wordCount: number;
  readingMinutes: number;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Returns a new, sorted copy of `entries` according to `sort`. */
export function sortProjectEntries(
  entries: ProjectEntry[],
  sort: ProjectsSort,
): ProjectEntry[] {
  const next = [...entries];
  switch (sort) {
    case "updated-desc":
      next.sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
      break;
    case "created-desc":
      next.sort((a, b) => b.project.createdAt.localeCompare(a.project.createdAt));
      break;
    case "created-asc":
      next.sort((a, b) => a.project.createdAt.localeCompare(b.project.createdAt));
      break;
    case "title-asc":
      next.sort((a, b) => collator.compare(a.project.title, b.project.title));
      break;
    case "words-desc":
      next.sort((a, b) => b.wordCount - a.wordCount);
      break;
    case "reading-desc":
      next.sort((a, b) => b.readingMinutes - a.readingMinutes);
      break;
  }
  return next;
}
