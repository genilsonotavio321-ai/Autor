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

class PdfWriter {
  private readonly doc: jsPDF;
  private y = MARGIN;

  constructor(title: string) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
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

  heading(text: string, level: number): void {
    const size = [20, 16, 14][Math.min(level, 3) - 1] ?? 14;
    this.doc.setFont("times", "bold").setFontSize(size);
    const width = this.doc.internal.pageSize.getWidth() - 2 * MARGIN;
    const lines: string[] = this.doc.splitTextToSize(sanitize(text), width);
    this.gap(10);
    for (const line of lines) {
      this.ensureSpace(LINE_HEIGHT + 4);
      this.doc.text(line, MARGIN, this.y + size);
      this.y += size + 8;
    }
    this.gap(6);
  }

  paragraph(text: string, options?: { prefix?: string; italic?: boolean }): void {
    const full = `${options?.prefix ?? ""}${text}`;
    const width = this.doc.internal.pageSize.getWidth() - 2 * MARGIN;
    this.doc.setFont("times", options?.italic ? "italic" : "normal").setFontSize(BODY_SIZE);
    const lines: string[] = this.doc.splitTextToSize(sanitize(full), width);
    for (const line of lines) {
      this.ensureSpace(LINE_HEIGHT);
      this.doc.text(line, MARGIN, this.y + BODY_SIZE);
      this.y += LINE_HEIGHT;
    }
    this.gap(4);
  }

  save(): Blob {
    return this.doc.output("blob");
  }
}

function writeDoc(writer: PdfWriter, doc: Json, depth = 0): void {
  const rawBlocks = (doc as Record<string, Json>).content;
  const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];

  for (const block of blocks) {
    if (block === null || typeof block !== "object" || Array.isArray(block)) continue;
    const record = block as Record<string, Json>;

    switch (record.type) {
      case "heading":
        writer.heading(inlineText(record), Number(record.level ?? 1));
        break;
      case "paragraph":
        writer.paragraph(inlineText(record));
        break;
      case "codeBlock":
        writer.paragraph(inlineText(record));
        break;
      case "blockquote":
        writer.paragraph(inlineText(record), { prefix: "> ", italic: true });
        break;
      case "bulletList":
      case "orderedList": {
        const ordered = record.type === "orderedList";
        const items = Array.isArray(record.content) ? record.content : [];
        let counter = 0;
        for (const item of items) {
          counter += 1;
          const prefix = ordered ? `${counter}. ` : "- ";
          writer.paragraph(inlineText(item), {
            prefix: `${"  ".repeat(depth)}${prefix}`,
          });
        }
        break;
      }
      case "listItem": {
        const itemChildren = Array.isArray(record.content) ? record.content : [];
        writeDoc(writer, { type: "doc", content: itemChildren }, depth);
        break;
      }
      case "horizontalRule":
        writer.gap(8);
        break;
      default:
        break;
    }
  }
}

/** Builds the whole project as a PDF file blob (one page break per section). */
export function buildPdfBlob(project: Project, chapters: PdfChapterInput[]): Blob {
  const writer = new PdfWriter(project.title);

  writer.gap(24);
  if (project.subtitle) writer.paragraph(project.subtitle, { italic: true });
  if (project.author) writer.paragraph(`Autor: ${project.author}`);
  if (project.description) writer.paragraph(project.description);

  for (const chapter of chapters) {
    writer.newPage();
    writer.heading(chapter.title, 1);
    writeDoc(writer, chapter.content);
  }

  return writer.save();
}
