import type { Json, Note } from "@/shared/types/database";

import { docToMarkdown } from "./markdown";

/** Anything with a title and Tiptap content (chapter, scene…). */
export interface TextChapterInput {
  title: string;
  content: Json;
}

/** Text of a single block: text nodes in order, hard breaks as newlines. */
function blockText(node: Json): string {
  if (Array.isArray(node)) return node.map(blockText).join("");
  if (node === null || typeof node !== "object") return "";
  const record = node as Record<string, Json>;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  if (record.type === "hardBreak") return "\n";
  return Array.isArray(record.content)
    ? record.content.map(blockText).join("")
    : "";
}

/**
 * Inverse of plainTextToDoc: top-level blocks joined by a blank line, so a
 * .txt export keeps paragraph structure and round-trips through the importer.
 */
function docToPlain(doc: Json): string {
  if (Array.isArray(doc) || doc === null || typeof doc !== "object") {
    return blockText(doc);
  }
  const content = (doc as Record<string, Json>).content;
  if (!Array.isArray(content)) return blockText(doc);
  return content
    .map(blockText)
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Chapter as plain text: title, blank line, body. */
export function chapterToTxt(chapter: TextChapterInput): string {
  const title = chapter.title.trim();
  const body = docToPlain(chapter.content).trim();
  const text = [title, body].filter(Boolean).join("\n\n");
  return text ? `${text}\n` : "";
}

/** Chapter as Markdown: level-1 heading plus the rendered body. */
export function chapterToMd(chapter: TextChapterInput): string {
  const title = chapter.title.trim();
  const body = docToMarkdown(chapter.content);
  const text = [title ? `# ${title}` : "", body].filter(Boolean).join("\n\n");
  return text ? `${text}\n` : "";
}

function noteBlock(note: Note, heading: boolean): string {
  const title = note.title.trim();
  const body = note.content.trim();
  const label = title && heading ? `## ${title}` : title;
  return [label, body].filter(Boolean).join("\n\n");
}

/** Notes as plain text — one block per note (title, blank line, body). */
export function notesToTxt(notes: Note[]): string {
  const blocks = notes.map((note) => noteBlock(note, false)).filter(Boolean);
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

/** Notes as Markdown — each note under a level-2 heading. */
export function notesToMd(notes: Note[]): string {
  const blocks = notes.map((note) => noteBlock(note, true)).filter(Boolean);
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

/**
 * Wraps plain text into a Tiptap document: blank lines separate paragraphs
 * and single newlines become hard breaks (structure is preserved verbatim).
 */
export function plainTextToDoc(text: string): Json {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+$/, ""))
    .filter((block) => block.trim() !== "");

  const content: Json[] = blocks.map((block) => ({
    type: "paragraph",
    content: block
      .split("\n")
      .flatMap((line, index, lines): Json[] =>
        index === lines.length - 1
          ? [{ type: "text", text: line }]
          : [
              { type: "text", text: line },
              { type: "hardBreak" },
            ],
      ),
  }));

  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}
