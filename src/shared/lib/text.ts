import type { Json } from "@/shared/types/database";

/**
 * Extracts the plain text of a Tiptap document JSON without an editor.
 * Collects every `text` node, in document order.
 */
export function extractDocText(doc: Json): string {
  const parts: string[] = [];
  collectText(doc, parts);
  return parts.join(" ");
}

function collectText(node: Json, out: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const record = node as Record<string, Json>;
  if (record.type === "text" && typeof record.text === "string") {
    out.push(record.text);
    return;
  }
  for (const value of Object.values(record)) collectText(value, out);
}

/** Collapses whitespace and trims — used for excerpts. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Accent- and case-folded form used on both sides of search so that
 * "dragao" matches "Dragão".
 */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
