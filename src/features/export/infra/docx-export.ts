import {
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import { extractDocText } from "@/shared/lib/text";
import type { Json, Project } from "@/shared/types/database";

export interface DocxChapterInput {
  title: string;
  content: Json;
}

function runsFromInline(node: Json): TextRun[] {
  if (Array.isArray(node)) return node.flatMap(runsFromInline);
  if (node === null || typeof node !== "object") return [];
  const record = node as Record<string, Json>;

  if (record.type === "text" && typeof record.text === "string") {
    const marks = (record.marks ?? []) as Array<Record<string, unknown>>;
    const has = (name: string) => marks.some((mark) => mark.type === name);
    return [
      new TextRun({
        text: record.text,
        bold: has("bold") || undefined,
        italics: has("italic") || undefined,
        strike: has("strike") || undefined,
        font: has("code") ? "Courier New" : undefined,
      }),
    ];
  }
  return runsFromInline(record.content ?? []);
}

function paragraphsFromDoc(doc: Json): Paragraph[] {
  const rawBlocks = (doc as Record<string, Json>).content;
  const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];
  const out: Paragraph[] = [];

  const walk = (node: Json, depth: number): void => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    const record = node as Record<string, Json>;

    switch (record.type) {
      case "heading": {
        const level = Math.min(Math.max(Number(record.level ?? 1), 1), 3);
        out.push(
          new Paragraph({
            heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][
              level - 1
            ],
            children: runsFromInline(record.content ?? []),
          }),
        );
        break;
      }
      case "paragraph":
        out.push(new Paragraph({ children: runsFromInline(record.content ?? []) }));
        break;
      case "codeBlock": {
        const text = extractDocText({ content: record.content ?? [] });
        out.push(
          new Paragraph({
            children: [new TextRun({ text, font: "Courier New" })],
          }),
        );
        break;
      }
      case "blockquote":
        out.push(
          new Paragraph({
            indent: { left: 480 },
            children: runsFromInline(record.content ?? []),
          }),
        );
        break;
      case "bulletList":
      case "orderedList": {
        const ordered = record.type === "orderedList";
        const items = Array.isArray(record.content) ? record.content : [];
        for (const item of items) {
          const itemRecord = item as Record<string, Json>;
          const itemChildren = Array.isArray(itemRecord.content)
            ? itemRecord.content
            : [];
          for (const child of itemChildren) {
            const childRecord = child as Record<string, Json>;
            if (childRecord.type !== "paragraph") continue;
            out.push(
              new Paragraph({
                bullet: ordered ? undefined : { level: Math.min(depth, 2) },
                numbering: ordered
                  ? { reference: "ordered-list", level: Math.min(depth, 2) }
                  : undefined,
                children: runsFromInline(childRecord.content ?? []),
              }),
            );
          }
        }
        break;
      }
      case "listItem": {
        const itemChildren = Array.isArray(record.content) ? record.content : [];
        for (const child of itemChildren) walk(child, depth);
        break;
      }
      case "horizontalRule":
        // Visible separator: an empty paragraph carrying a bottom border.
        out.push(
          new Paragraph({
            children: [],
            spacing: { before: 120, after: 120 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: "999999",
                space: 1,
              },
            },
          }),
        );
        break;
      default: {
        const children = Array.isArray(record.content) ? record.content : [];
        if (children.length > 0) {
          for (const child of children) walk(child, depth);
        }
      }
    }
  };

  for (const block of blocks) walk(block, 0);
  return out;
}

/** Builds the whole project as a DOCX file blob. */
export async function buildDocxBlob(
  project: Project,
  chapters: DocxChapterInput[],
): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: project.title, bold: true, size: 48 })],
    }),
  );
  if (project.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: project.subtitle, italics: true, size: 28 })],
      }),
    );
  }
  if (project.author) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `Autor: ${project.author}` })] }),
    );
  }

  const ordered = [...chapters];
  ordered.forEach((chapter) => {
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        children: [new TextRun({ text: chapter.title, bold: true, size: 32 })],
      }),
    );
    children.push(...paragraphsFromDoc(chapter.content));
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: "left" as const,
            style: { paragraph: { indent: { left: 720 * (level + 1) } } },
          })),
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}
