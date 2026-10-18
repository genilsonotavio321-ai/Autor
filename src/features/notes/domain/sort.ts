import type { Note } from "@/shared/types/database";

/** Client-side ordering options for the notes grid. */
export type NotesSort =
  | "updated"
  | "created-desc"
  | "created-asc"
  | "title-asc"
  | "title-desc"
  | "manual";

export const NOTES_SORT_LABELS: Record<NotesSort, string> = {
  updated: "Última atualizada",
  "created-desc": "Mais recentes",
  "created-asc": "Mais antigas",
  "title-asc": "Título (A–Z)",
  "title-desc": "Título (Z–A)",
  manual: "Ordem manual",
};

/** Newest update first — the pre-existing behavior of the notes page. */
const byUpdatedDesc = (a: Note, b: Note) =>
  b.updatedAt.localeCompare(a.updatedAt);

function tiebreak(a: Note, b: Note): number {
  return byUpdatedDesc(a, b);
}

function comparatorFor(sort: NotesSort): (a: Note, b: Note) => number {
  switch (sort) {
    case "created-desc":
      return (a, b) => b.createdAt.localeCompare(a.createdAt) || tiebreak(a, b);
    case "created-asc":
      return (a, b) => a.createdAt.localeCompare(b.createdAt) || tiebreak(a, b);
    case "title-asc":
      return (a, b) => a.title.localeCompare(b.title, "pt-BR") || tiebreak(a, b);
    case "title-desc":
      return (a, b) => b.title.localeCompare(a.title, "pt-BR") || tiebreak(a, b);
    case "manual":
      return (a, b) => (a.order ?? 0) - (b.order ?? 0) || tiebreak(a, b);
    case "updated":
    default:
      return byUpdatedDesc;
  }
}

/**
 * Pure sort used by the notes grid. Pinned notes always come first, in every
 * mode; the comparator only decides the order inside each group.
 */
export function sortNotes(notes: Note[], sort: NotesSort): Note[] {
  const compare = comparatorFor(sort);
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return compare(a, b);
  });
}
