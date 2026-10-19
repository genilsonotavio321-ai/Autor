import { jsPDF } from "jspdf";

import type { Json, Project } from "@/shared/types/database";

export interface PdfChapterInput {
  title: string;
  content: Json;
}

const MARGIN = 56;
const BODY_SIZE = 12;
const LINE_HEIGHT = 16;

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

function inlineText(node: Json): string {
  if (Array.isArray(node)) return node.map(inlineText).join("");
  if (node === null || typeof node !== "object") return "";
  const record = node as Record<string, Json>;
  if (record.type === "text" && typeof record.text === "string") return record.text;
  return inlineText(record.content ?? []);
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

/** jsPDF anchors center/right alignment on the x coordinate itself. */
function alignAnchor(align: PdfAlign, left: number, width: number): number {
  if (align === "center") return left + width / 2;
  if (align === "right") return left + width;
  return left;
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

  heading(text: string, level: number, align: PdfAlign = "left"): void {
    const size = [20, 16, 14][Math.min(level, 3) - 1] ?? 14;
    this.doc.setFont("times", "bold").setFontSize(size);
    const width = this.doc.internal.pageSize.getWidth() - 2 * MARGIN;
    const lines: string[] = this.doc.splitTextToSize(sanitize(text), width);
    this.gap(10);
    for (const line of lines) {
      this.ensureSpace(size + 8);
      this.doc.text(line, alignAnchor(align, MARGIN, width), this.y + size, {
        align: align === "justify" ? "left" : align,
      });
      this.y += size + 8;
    }
    this.gap(6);
  }

  paragraph(
    text: string,
    options?: {
      prefix?: string;
      italic?: boolean;
      indent?: number;
      align?: PdfAlign;
    },
  ): void {
    const align = options?.align ?? "left";
    const indent = options?.indent ?? 0;
    const full = `${options?.prefix ?? ""}${text}`;
    const width = this.doc.internal.pageSize.getWidth() - 2 * MARGIN - indent;
    this.doc.setFont("times", options?.italic ? "italic" : "normal").setFontSize(BODY_SIZE);
    const lines: string[] = this.doc.splitTextToSize(sanitize(full), width);
    const x = MARGIN + indent;
    lines.forEach((line, index) => {
      this.ensureSpace(LINE_HEIGHT);
      const isLast = index === lines.length - 1;
      if (align === "justify" && !isLast && line.includes(" ")) {
        this.doc.text(line, x, this.y + BODY_SIZE, {
          align: "justify",
          maxWidth: width,
        });
      } else {
        this.doc.text(line, alignAnchor(align, x, width), this.y + BODY_SIZE, {
          align: align === "justify" ? "left" : align,
        });
      }
      this.y += LINE_HEIGHT;
    });
    this.gap(4);
  }

  /** Blockquote: indented italic text with a vertical rule on the left. */
  quote(text: string, options?: { indent?: number; align?: PdfAlign }): void {
    const align = options?.align ?? "left";
    const barX = MARGIN + 12 + (options?.indent ?? 0);
    const textIndent = 12 + (options?.indent ?? 0) + 12;
    const width = this.doc.internal.pageSize.getWidth() - 2 * MARGIN - textIndent;
    this.doc.setFont("times", "italic").setFontSize(BODY_SIZE);
    const lines: string[] = this.doc.splitTextToSize(sanitize(text), width);
    this.ensureSpace(lines.length * LINE_HEIGHT + 8);
    const top = this.y + 2;
    const x = MARGIN + textIndent;
    for (const line of lines) {
      this.doc.text(line, alignAnchor(align, x, width), this.y + BODY_SIZE, {
        align: align === "justify" ? "left" : align,
      });
      this.y += LINE_HEIGHT;
    }
    this.doc.setDrawColor(150).setLineWidth(1);
    this.doc.line(barX, top, barX, this.y - LINE_HEIGHT + BODY_SIZE + 2);
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
    const label = textBlocks.length > 0 ? inlineText(textBlocks[0] ?? null) : inlineText(item);
    writer.paragraph(label, { prefix: `${marker} `, indent });
    for (const extra of textBlocks.slice(1)) {
      writer.paragraph(inlineText(extra), { indent: indent + 14 });
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
        writer.heading(inlineText(record), Number(record.level ?? 1), blockAlign(record));
        break;
      case "paragraph":
        writer.paragraph(inlineText(record), { align: blockAlign(record) });
        break;
      case "codeBlock":
        writer.paragraph(inlineText(record), { indent: 12, align: blockAlign(record) });
        break;
      case "blockquote":
        writer.quote(inlineText(record), { indent: depth * 18, align: blockAlign(record) });
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
