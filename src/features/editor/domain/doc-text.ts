import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** A contiguous slice of text inside a block, tagged with its doc position. */
export interface TextRun {
  /** Doc position of the first character of this run. */
  start: number;
  text: string;
}

/**
 * Collects the inline text runs of a text block (paragraph, heading…) so
 * string offsets can be mapped back to doc positions. Text nodes sit at
 * `blockPos + 1 + offset`; a `hardBreak` counts as a single `"\n"` so string
 * offsets stay aligned with positions.
 */
export function runsForBlock(block: ProseMirrorNode, blockPos: number): TextRun[] {
  const runs: TextRun[] = [];
  block.forEach((child, offset) => {
    if (child.isText && child.text) {
      runs.push({ start: blockPos + 1 + offset, text: child.text });
    } else if (child.type.name === "hardBreak") {
      runs.push({ start: blockPos + 1 + offset, text: "\n" });
    }
  });
  return runs;
}

/** Joins the runs of a block; offsets line up with `indexToPos`. */
export function runsToText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** Maps a string offset inside a block's joined runs to a doc position. */
export function indexToPos(
  runs: TextRun[],
  blockEnd: number,
  index: number,
): number {
  let cursor = 0;
  for (const run of runs) {
    if (index < cursor + run.text.length) {
      return run.start + (index - cursor);
    }
    cursor += run.text.length;
  }
  return blockEnd;
}
