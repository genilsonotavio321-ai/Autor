import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { indexToPos, runsForBlock, runsToText } from "./doc-text";

export type ReviewIssueType = "repeated-word" | "spacing" | "punctuation";

export interface ReviewIssue {
  type: ReviewIssueType;
  /** Start offset (string offset in `detectTextIssues`, doc position in `findRepeatedWords`). */
  from: number;
  /** End offset (exclusive). */
  to: number;
  /** Surrounding text so the writer recognises the spot. */
  preview: string;
  /** Replacement for the `[from, to)` range. */
  suggestion: string;
}

interface Candidate {
  type: ReviewIssueType;
  start: number;
  end: number;
  suggestion: string;
  /** Lower runs first; overlapping candidates of a later rule are dropped. */
  priority: number;
}

// `{1,}` so single-letter Portuguese words ("o o", "a a") are caught too; the
// lookarounds already keep "o orfanato" from matching.
const REPEATED_WORD = /(?<!\p{L})(\p{L}{1,})(\s+)\1(?!\p{L})/giu;
const SPACE_BEFORE_PUNCT = / +([,.;:!?])/g;
const DOUBLE_SPACE = /(?<=\S) {2,}(?=\S)/g;
const REPEATED_PUNCT = /([,.;:!?])\1+/g;

function previewAround(text: string, start: number, end: number): string {
  const context = 24;
  const from = Math.max(0, start - context);
  const to = Math.min(text.length, end + context);
  const slice = text.slice(from, to).replace(/\s+/g, " ").trim();
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}

/**
 * Finds review issues in a plain string. Offsets are string indices, so this
 * is the testable core; `findRepeatedWords` maps the same rules onto doc
 * positions. Rules never overlap: a higher-priority match claims its range.
 */
export function detectTextIssues(text: string): ReviewIssue[] {
  const candidates: Candidate[] = [];

  for (const match of text.matchAll(REPEATED_WORD)) {
    candidates.push({
      type: "repeated-word",
      start: match.index,
      end: match.index + match[0].length,
      suggestion: match[1] ?? "",
      priority: 0,
    });
  }

  for (const match of text.matchAll(SPACE_BEFORE_PUNCT)) {
    candidates.push({
      type: "punctuation",
      start: match.index,
      end: match.index + match[0].length,
      suggestion: match[1] ?? "",
      priority: 1,
    });
  }

  for (const match of text.matchAll(DOUBLE_SPACE)) {
    candidates.push({
      type: "spacing",
      start: match.index,
      end: match.index + match[0].length,
      suggestion: " ",
      priority: 2,
    });
  }

  for (const match of text.matchAll(REPEATED_PUNCT)) {
    // Keep ellipses ("...") untouched — they are intentional in prose.
    if (match[1] === "." && match[0].length === 3) continue;
    candidates.push({
      type: "punctuation",
      start: match.index,
      end: match.index + match[0].length,
      suggestion: match[1] ?? "",
      priority: 3,
    });
  }

  candidates.sort((a, b) => a.priority - b.priority || a.start - b.start);

  const covered = new Array<boolean>(text.length).fill(false);
  const accepted: ReviewIssue[] = [];
  for (const candidate of candidates) {
    let overlaps = false;
    for (let i = candidate.start; i < candidate.end; i += 1) {
      if (covered[i]) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    for (let i = candidate.start; i < candidate.end; i += 1) covered[i] = true;
    accepted.push({
      type: candidate.type,
      from: candidate.start,
      to: candidate.end,
      preview: previewAround(text, candidate.start, candidate.end),
      suggestion: candidate.suggestion,
    });
  }

  return accepted.sort((a, b) => a.from - b.from);
}

/**
 * Finds review issues across a Tiptap document. Each text block (paragraph,
 * heading…) is scanned independently so a word never spans two paragraphs,
 * and the returned `from`/`to` are doc positions usable with
 * `editor.chain().insertContentAt`.
 */
export function findRepeatedWords(doc: ProseMirrorNode): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const runs = runsForBlock(node, pos);
    if (runs.length === 0) return;
    const text = runsToText(runs);
    const blockEnd = pos + 1 + node.content.size;
    for (const issue of detectTextIssues(text)) {
      issues.push({
        ...issue,
        from: indexToPos(runs, blockEnd, issue.from),
        to: indexToPos(runs, blockEnd, issue.to),
      });
    }
  });
  return issues;
}
