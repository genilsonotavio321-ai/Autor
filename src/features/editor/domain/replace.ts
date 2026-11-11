import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { indexToPos, runsForBlock, runsToText } from "./doc-text";

/** A `[from, to)` range in doc positions. */
export interface TextRange {
  from: number;
  to: number;
}

export interface FindTextOptions {
  /** Defaults to `false` (case-insensitive). */
  caseSensitive?: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds every occurrence of `query` in the document text. Matching runs on the
 * original string (a `gi`/`giu` regex) so accented and mixed-case matches keep
 * offsets aligned, and each block is scanned on its own — a match never spans
 * two paragraphs. Returned offsets are doc positions usable with
 * `editor.chain().insertContentAt`.
 */
export function findTextRanges(
  doc: ProseMirrorNode,
  query: string,
  options: FindTextOptions = {},
): TextRange[] {
  if (query.length === 0) return [];

  const flags = options.caseSensitive ? "gu" : "giu";
  const pattern = new RegExp(escapeRegExp(query), flags);
  const ranges: TextRange[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const runs = runsForBlock(node, pos);
    if (runs.length === 0) return;
    const blockEnd = pos + 1 + node.content.size;
    for (const match of runsToText(runs).matchAll(pattern)) {
      if (match.index === undefined) continue;
      ranges.push({
        from: indexToPos(runs, blockEnd, match.index),
        to: indexToPos(runs, blockEnd, match.index + match[0].length),
      });
    }
  });

  return ranges;
}

/** A short context around one occurrence, for the match list (item 19). */
export interface RangePreview {
  before: string;
  match: string;
  after: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
}

/**
 * Reads the text around a range so the "Substituir" list can show where the
 * occurrence is. Block boundaries become spaces; `radius` is the number of
 * characters of context on each side.
 */
export function previewForRange(
  doc: ProseMirrorNode,
  range: TextRange,
  radius = 24,
): RangePreview {
  const size = doc.content.size;
  const start = Math.max(0, range.from - radius);
  const end = Math.min(size, range.to + radius);
  return {
    before: doc.textBetween(start, range.from, " ", " "),
    match: doc.textBetween(range.from, range.to, " ", " "),
    after: doc.textBetween(range.to, end, " ", " "),
    truncatedStart: start > 0,
    truncatedEnd: end < size,
  };
}
