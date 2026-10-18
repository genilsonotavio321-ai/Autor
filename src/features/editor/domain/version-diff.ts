import type { Json } from "@/shared/types/database";

/** One top-level block of a Tiptap document, flattened to comparable text. */
export interface DiffBlock {
  /** Block kind — heading changes count as edits even with equal text. */
  kind: "heading" | "paragraph" | "code" | "quote" | "list-item";
  /** Heading level (1-6) when `kind === "heading"`. */
  level?: number;
  text: string;
}

export interface DiffLine {
  type: "same" | "removed" | "added";
  block: DiffBlock;
}

interface TiptapNode {
  type?: unknown;
  content?: unknown;
  text?: unknown;
  attrs?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Collect plain text of a Tiptap node subtree (inline content). */
function inlineText(node: unknown): string {
  if (!isRecord(node)) return "";
  const typed = node as TiptapNode;
  if (typeof typed.text === "string") return typed.text;
  if (!Array.isArray(typed.content)) return "";
  return typed.content
    .map((child) => inlineText(child))
    .filter(Boolean)
    .join("");
}

/** Flatten a Tiptap document into paragraph-granularity diff blocks. */
export function docToBlocks(doc: Json | null | undefined): DiffBlock[] {
  if (!isRecord(doc) || !Array.isArray(doc.content)) return [];
  const blocks: DiffBlock[] = [];
  for (const raw of doc.content) {
    if (!isRecord(raw)) continue;
    const node = raw as TiptapNode & Record<string, unknown>;
    const text = inlineText(node).trim();
    switch (node.type) {
      case "heading": {
        const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
        blocks.push({ kind: "heading", level, text });
        break;
      }
      case "codeBlock":
        blocks.push({ kind: "code", text });
        break;
      case "blockquote":
        blocks.push({ kind: "quote", text });
        break;
      case "bulletList":
      case "orderedList": {
        collectListItems(node, 0, blocks);
        break;
      }
      case "paragraph":
      default:
        // Empty paragraphs still separate content — keep them so insertions
        // of blank lines show up in the diff.
        blocks.push({ kind: "paragraph", text });
        break;
    }
  }
  return blocks;
}

function collectListItems(list: TiptapNode, depth: number, out: DiffBlock[]) {
  if (!Array.isArray(list.content)) return;
  for (const raw of list.content) {
    if (!isRecord(raw)) continue;
    const item = raw as TiptapNode;
    if (item.type !== "listItem" || !Array.isArray(item.content)) continue;
    for (const childRaw of item.content) {
      if (!isRecord(childRaw)) continue;
      const child = childRaw as TiptapNode;
      if (child.type === "paragraph") {
        const indent = depth > 0 ? `${"  ".repeat(depth)}- ` : "- ";
        out.push({ kind: "list-item", text: indent + inlineText(child).trim() });
      } else if (child.type === "bulletList" || child.type === "orderedList") {
        collectListItems(child, depth + 1, out);
      }
    }
  }
}

function blockKey(block: DiffBlock): string {
  const level = block.kind === "heading" ? `${block.level ?? 1}:` : "";
  return `${level}${block.kind}:${block.text}`;
}

/**
 * Classic LCS diff over blocks: returns the interleaving of unchanged,
 * removed (only in current) and added (only in snapshot) lines.
 * "added" means the snapshot brings content the editor doesn't have yet.
 */
export function diffBlocks(
  current: DiffBlock[],
  snapshot: DiffBlock[],
): DiffLine[] {
  const n = current.length;
  const m = snapshot.length;
  // lcs[i][j] = LCS length of current[i:] vs snapshot[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] =
        blockKey(current[i]!) === blockKey(snapshot[j]!)
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (blockKey(current[i]!) === blockKey(snapshot[j]!)) {
      lines.push({ type: "same", block: current[i]! });
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      lines.push({ type: "removed", block: current[i]! });
      i += 1;
    } else {
      lines.push({ type: "added", block: snapshot[j]! });
      j += 1;
    }
  }
  while (i < n) {
    lines.push({ type: "removed", block: current[i]! });
    i += 1;
  }
  while (j < m) {
    lines.push({ type: "added", block: snapshot[j]! });
    j += 1;
  }
  return lines;
}

/** Diff the editor's current document against a stored version snapshot. */
export function diffDocAgainstSnapshot(
  current: Json | null | undefined,
  snapshot: Json | null | undefined,
): DiffLine[] {
  return diffBlocks(docToBlocks(current), docToBlocks(snapshot));
}
