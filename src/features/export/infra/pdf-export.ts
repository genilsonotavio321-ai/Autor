import { jsPDF } from "jspdf";

import type { Json, Project } from "@/shared/types/database";

import { headingLevel } from "../domain/heading-level";

export interface PdfChapterInput {
  title: string;
  content: Json;
}

const MARGIN = 56;
const BODY_SIZE = 12;
const LINE_HEIGHT = 16;

/** Inline segment of a block, already mapped onto one of jsPDF's base fonts. */
interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

type PdfFont = "normal" | "bold" | "italic" | "bolditalic";

function fontOf(bold: boolean, italic: boolean): PdfFont {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

/**
 * jsPDF's built-in fonts are WinAnsi: keep the text inside Latin-1 so
 * pt-BR accents render and nothing silently turns into blanks.
 */
function sanitize(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\xFF\n]/g, "");
}

type PdfAlign = "left" | "center" | "right" | "justify";

function isNode(value: Json | undefined): value is Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reads TipTap's `textAlign` attribute, ignoring unsupported values. */
function blockAlign(record: Record<string, Json>): PdfAlign {
  const attrs = record.attrs;
  if (!isNode(attrs)) return "left";
  const value = attrs.textAlign;
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function plainRuns(text: string): TextRun[] {
  return [{ text, bold: false, italic: false }];
}

/**
 * Flattens a block into styled runs, mapping the `bold`/`italic` marks onto
 * the matching base font. Markless text stays on the regular font.
 */
function inlineRuns(node: Json): TextRun[] {
  const runs: TextRun[] = [];

  function walk(value: Json, bold: boolean, italic: boolean): void {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, bold, italic);
      return;
    }
    if (!isNode(value)) return;
    const record = value;
    let nextBold = bold;
    let nextItalic = italic;
    const marks = record.marks;
    if (Array.isArray(marks)) {
      for (const mark of marks) {
        if (!isNode(mark)) continue;
        if (mark.type === "bold") nextBold = true;
        if (mark.type === "italic") nextItalic = true;
      }
    }
    if (record.type === "text" && typeof record.text === "string") {
      if (record.text.length > 0) {
        runs.push({ text: record.text, bold: nextBold, italic: nextItalic });
      }
      return;
    }
    // A hard break starts a new line; a single space keeps the words apart.
    if (record.type === "hardBreak") {
      runs.push({ text: " ", bold: nextBold, italic: nextItalic });
      return;
    }
    walk(record.content ?? [], nextBold, nextItalic);
  }

  walk(node, false, false);
  return runs;
}

function runsOf(content: string | TextRun[]): TextRun[] {
  return typeof content === "string" ? plainRuns(content) : content;
}

interface TextToken {
  text: string;
  font: PdfFont;
  /** Whitespace-only token: it only contributes horizontal advance. */
  space: boolean;
  width: number;
}

/** Merges neighbours drawn with the same font into a single text operator. */
function mergeTokens(tokens: TextToken[]): TextToken[] {
  const merged: TextToken[] = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.font === token.font) {
      last.text += token.text;
      last.width += token.width;
      last.space = last.space && token.space;
      continue;
    }
    merged.push({ ...token });
  }
  return merged;
}

class PdfWriter {
  private readonly doc: jsPDF;
  private y = MARGIN;

  constructor(title: string | null) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    if (title === null) return;
    const width = this.doc.internal.pageSize.getWidth();

    this.doc.setFont("times", "bold").setFontSize(24);
    const titleLines = this.doc.splitTextToSize(sanitize(title), width - 2 * MARGIN);
    let startY = this.doc.internal.pageSize.getHeight() / 3;
    for (const line of titleLines) {
      this.doc.text(line, width / 2, startY, { align: "center" });
      startY += 30;
    }
  }

  newPage(): void {
    this.doc.addPage();
    this.y = MARGIN;
  }

  ensureSpace(height: number): void {
    const pageHeight = this.doc.internal.pageSize.getHeight();
    if (this.y + height > pageHeight - MARGIN) this.newPage();
  }

  gap(height = LINE_HEIGHT): void {
    this.ensureSpace(height);
    this.y += height;
  }

  private contentWidth(indent: number): number {
    return this.doc.internal.pageSize.getWidth() - 2 * MARGIN - indent;
  }

  /** Splits the runs into measured tokens (words and whitespace). */
  private measure(
    runs: TextRun[],
    size: number,
    forceBold: boolean,
    forceItalic: boolean,
  ): TextToken[] {
    const tokens: TextToken[] = [];
    for (const run of runs) {
      const font = fontOf(run.bold || forceBold, run.italic || forceItalic);
      const text = sanitize(run.text).replace(/\s+/g, " ");
      if (text.length === 0) continue;
      this.doc.setFont("times", font).setFontSize(size);
      for (const piece of text.split(/( +)/)) {
        if (piece.length === 0) continue;
        tokens.push({
          text: piece,
          font,
          space: /^ +$/.test(piece),
          width: this.doc.getTextWidth(piece),
        });
      }
    }
    return tokens;
  }

  /** Greedy word wrap; the trailing spaces of a line never count. */
  private wrapTokens(tokens: TextToken[], width: number): TextToken[][] {
    const lines: TextToken[][] = [];
    let current: TextToken[] = [];
    let currentWidth = 0;

    const dropTrailingSpaces = () => {
      while (current.length > 0 && current[current.length - 1]!.space) {
        currentWidth -= current.pop()!.width;
      }
    };

    for (const token of tokens) {
      if (token.space && current.length === 0) continue;
      if (!token.space && current.length > 0 && currentWidth + token.width > width) {
        dropTrailingSpaces();
        lines.push(current);
        current = [];
        currentWidth = 0;
      }
      current.push(token);
      currentWidth += token.width;
    }

    dropTrailingSpaces();
    if (current.length > 0) lines.push(current);
    if (lines.length === 0) lines.push([]);
    return lines;
  }

  /** Draws one wrapped line, computing the x anchor from the alignment. */
  private drawLine(
    line: TextToken[],
    x0: number,
    width: number,
    size: number,
    align: PdfAlign,
    isLast: boolean,
  ): void {
    const lineWidth = line.reduce((sum, token) => sum + token.width, 0);
    const spaces = line.filter((token) => token.space).length;
    const stretch = align === "justify" && !isLast && spaces > 0;
    const extra = stretch ? Math.max(0, (width - lineWidth) / spaces) : 0;

    let x = x0;
    if (!stretch && align === "center") {
      x = x0 + Math.max(0, (width - lineWidth) / 2);
    } else if (!stretch && align === "right") {
      x = x0 + Math.max(0, width - lineWidth);
    }

    const baseline = this.y + size;
    // Without justification the whole same-font line goes out as one operator.
    const segments = extra === 0 ? mergeTokens(line) : line;
    for (const segment of segments) {
      if (!segment.space) {
        this.doc.setFont("times", segment.font).setFontSize(size);
        this.doc.text(segment.text, x, baseline);
      }
      x += segment.width + (segment.space ? extra : 0);
    }
  }

  /** Wraps and draws a block of styled runs, advancing the cursor. */
  private layout(
    runs: TextRun[],
    options: {
      size: number;
      lineHeight: number;
      indent?: number;
      align?: PdfAlign;
      bold?: boolean;
      italic?: boolean;
      prefix?: TextRun;
    },
  ): void {
    const indent = options.indent ?? 0;
    const align = options.align ?? "left";
    const width = this.contentWidth(indent);
    const x0 = MARGIN + indent;
    const tokens = this.measure(
      options.prefix ? [options.prefix, ...runs] : runs,
      options.size,
      options.bold ?? false,
      options.italic ?? false,
    );
    const lines = this.wrapTokens(tokens, width);

    lines.forEach((line, index) => {
      this.ensureSpace(options.lineHeight);
      this.drawLine(
        line,
        x0,
        width,
        options.size,
        align,
        index === lines.length - 1,
      );
      this.y += options.lineHeight;
    });
  }

  heading(
    content: string | TextRun[],
    level: number,
    align: PdfAlign = "left",
  ): void {
    const size = [20, 16, 14][Math.min(level, 3) - 1] ?? 14;
    this.gap(10);
    this.layout(runsOf(content), {
      size,
      lineHeight: size + 8,
      align,
      bold: true,
    });
    this.gap(6);
  }

  paragraph(
    content: string | TextRun[],
    options?: {
      prefix?: string;
      italic?: boolean;
      indent?: number;
      align?: PdfAlign;
    },
  ): void {
    this.layout(runsOf(content), {
      size: BODY_SIZE,
      lineHeight: LINE_HEIGHT,
      indent: options?.indent,
      align: options?.align,
      italic: options?.italic,
      prefix: options?.prefix ? plainRuns(options.prefix)[0] : undefined,
    });
    this.gap(4);
  }

  /** Blockquote: indented italic text with a vertical rule on the left. */
  quote(content: string | TextRun[], options?: { indent?: number; align?: PdfAlign }): void {
    const runs = runsOf(content);
    const indent = options?.indent ?? 0;
    const textIndent = indent + 24;
    const width = this.contentWidth(textIndent);
    const lineCount = this.wrapTokens(
      this.measure(runs, BODY_SIZE, false, true),
      width,
    ).length;

    this.ensureSpace(lineCount * LINE_HEIGHT + 8);
    const top = this.y + 2;
    this.layout(runs, {
      size: BODY_SIZE,
      lineHeight: LINE_HEIGHT,
      indent: textIndent,
      align: options?.align,
      italic: true,
    });
    this.doc.setDrawColor(150).setLineWidth(1);
    this.doc.line(
      MARGIN + 12 + indent,
      top,
      MARGIN + 12 + indent,
      this.y - LINE_HEIGHT + BODY_SIZE + 2,
    );
    this.gap(6);
  }

  /** Horizontal rule: a visible separator line across the text column. */
  rule(): void {
    const width = this.doc.internal.pageSize.getWidth();
    this.gap(10);
    this.doc.setDrawColor(150).setLineWidth(0.75);
    this.doc.line(MARGIN, this.y, width - MARGIN, this.y);
    this.y += 12;
  }

  save(): Blob {
    return this.doc.output("blob");
  }
}

/** Renders a list, recursing into nested lists with a deeper indent. */
function writeList(
  writer: PdfWriter,
  list: Record<string, Json>,
  depth: number,
): void {
  const ordered = list.type === "orderedList";
  const orderedStart = isNode(list.attrs) ? Number(list.attrs.start ?? 1) : 1;
  const indent = 16 + depth * 18;
  const items = Array.isArray(list.content) ? list.content : [];
  let counter = (Number.isFinite(orderedStart) ? orderedStart : 1) - 1;

  for (const item of items) {
    if (!isNode(item)) continue;
    counter += 1;
    const marker = ordered ? `${counter}.` : "-";
    const children = Array.isArray(item.content) ? item.content : [];
    const textBlocks = children.filter(
      (child) => isNode(child) && (child.type === "paragraph" || child.type === "heading"),
    );
    const label = textBlocks[0] ?? item;
    writer.paragraph(inlineRuns(label), { prefix: `${marker} `, indent });
    for (const extra of textBlocks.slice(1)) {
      writer.paragraph(inlineRuns(extra), { indent: indent + 14 });
    }
    const nested = children.filter((child) => !textBlocks.includes(child));
    if (nested.length > 0) {
      writeDoc(writer, { type: "doc", content: nested }, depth + 1);
    }
  }
}

function writeDoc(writer: PdfWriter, doc: Json, depth = 0): void {
  const rawBlocks = (doc as Record<string, Json>).content;
  const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];

  for (const block of blocks) {
    if (!isNode(block)) continue;
    const record = block;

    switch (record.type) {
      case "heading":
        writer.heading(
          inlineRuns(record),
          headingLevel(record),
          blockAlign(record),
        );
        break;
      case "paragraph":
        writer.paragraph(inlineRuns(record), { align: blockAlign(record) });
        break;
      case "codeBlock":
        writer.paragraph(inlineRuns(record), {
          indent: 12,
          align: blockAlign(record),
        });
        break;
      case "blockquote":
        writer.quote(inlineRuns(record), {
          indent: depth * 18,
          align: blockAlign(record),
        });
        break;
      case "bulletList":
      case "orderedList":
        writeList(writer, record, depth);
        break;
      case "listItem": {
        const children = Array.isArray(record.content) ? record.content : [];
        writeDoc(writer, { type: "doc", content: children }, depth);
        break;
      }
      case "horizontalRule":
        writer.rule();
        break;
      default:
        break;
    }
  }
}

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
  chapters: PdfChapterInput[];
  /**
   * Renders the title cover page first (project export). When false the
   * document starts directly with the first chapter — used when sharing a
   * single chapter, where the cover would just repeat the title.
   */
  cover?: boolean;
}

/** Builds a PDF blob from a structured document (cover page optional). */
export function buildPdf({
  title,
  subtitle,
  author,
  description,
  chapters,
  cover = true,
}: PdfDocumentInput): Blob {
  const writer = new PdfWriter(cover ? title : null);

  if (cover) {
    writer.gap(24);
    if (subtitle) writer.paragraph(subtitle, { italic: true });
    if (author) writer.paragraph(`Autor: ${author}`);
    if (description) writer.paragraph(description);
  }

  chapters.forEach((chapter, index) => {
    // With a cover, chapter 1 starts on a fresh page; without one it starts
    // at the top of page 1.
    if (cover || index > 0) writer.newPage();
    writer.heading(chapter.title, 1);
    writeDoc(writer, chapter.content);
  });

  return writer.save();
}

/** Builds the whole project as a PDF file blob (one page break per section). */
export function buildPdfBlob(project: Project, chapters: PdfChapterInput[]): Blob {
  return buildPdf({
    title: project.title,
    subtitle: project.subtitle,
    author: project.author,
    description: project.description,
    chapters,
  });
}
