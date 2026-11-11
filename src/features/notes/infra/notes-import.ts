import type { EntityId } from "@/shared/types/database";

import { noteRepository } from "./dexie-note-repository";

/** A note parsed from an imported file, before it is persisted. */
export interface ImportedNoteDraft {
  title?: string;
  content: string;
}

/**
 * Parses a notes `.md` file, the inverse of `notesToMd`: each note is a block
 * under a `## Título` heading (title = heading, content = body until the next
 * heading). Text before the first heading becomes an untitled note.
 */
export function parseNotesMarkdown(text: string): ImportedNoteDraft[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const notes: ImportedNoteDraft[] = [];
  const preamble: string[] = [];
  let current: { title: string; body: string[] } | null = null;

  const flush = () => {
    if (current) {
      notes.push({ title: current.title, content: current.body.join("\n").trim() });
      current = null;
    }
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = { title: (heading[1] ?? "").trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  flush();

  const preambleText = preamble.join("\n").trim();
  if (preambleText) notes.unshift({ content: preambleText });

  return notes.filter((note) => note.title || note.content);
}

/**
 * Parses a notes `.txt` file: blocks separated by blank lines, the first line
 * of each block being the title and the rest the content.
 *
 * Note: because `notesToTxt` separates a note's title from its body with a
 * single blank line (the same separator used between notes), a full round-trip
 * of bodies is not guaranteed for `.txt` — use `.md` for lossless round-trips.
 */
export function parseNotesText(text: string): ImportedNoteDraft[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const notes: ImportedNoteDraft[] = [];
  for (const block of blocks) {
    const trimmed = block.replace(/\s+$/, "");
    if (!trimmed.trim()) continue;
    const [firstLine, ...rest] = trimmed.split("\n");
    notes.push({ title: (firstLine ?? "").trim(), content: rest.join("\n").trim() });
  }
  return notes;
}

/** Picks the parser by extension; `.md` uses the heading format, else blocks. */
export function parseNotesFile(
  filename: string,
  text: string,
): ImportedNoteDraft[] {
  return /\.md$/i.test(filename)
    ? parseNotesMarkdown(text)
    : parseNotesText(text);
}

/** Imports every note found in the file into the given project. */
export async function importNotesFile(
  projectId: EntityId,
  filename: string,
  text: string,
): Promise<{ created: number }> {
  const drafts = parseNotesFile(filename, text);
  for (const draft of drafts) {
    await noteRepository.create({
      projectId,
      title: draft.title,
      content: draft.content,
    });
  }
  return { created: drafts.length };
}
