import type { Json } from "@/shared/types/database";

/** Counts words in plain text (whitespace-separated). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Counts words in a Tiptap document JSON without instantiating an editor.
 * Collects every `text` node and counts across the joined string.
 */
export function countDocWords(doc: Json): number {
  const parts: string[] = [];
  collectText(doc, parts);
  return countWords(parts.join(" "));
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
