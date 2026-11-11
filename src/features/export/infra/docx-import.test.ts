import "fake-indexeddb/auto";
import { zipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import type { Project } from "@/shared/types/database";

import { buildDocxBlob, type DocxChapterInput } from "./docx-export";
import { docxXmlToTiptap, importDocxFile, splitDocxChapters } from "./docx-import";

const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  await getDatabase().projects.clear();
  await getDatabase().chapters.clear();
});

function docxBytes(entries: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, body]) => [
        name,
        new TextEncoder().encode(body),
      ]),
    ),
  );
}

const PARAGRAPH_DOC = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Primeiro parágrafo.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Segundo parágrafo.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

describe("docxXmlToTiptap", () => {
  it("converts plain paragraphs", () => {
    const doc = docxXmlToTiptap(PARAGRAPH_DOC) as {
      content: { type: string; content: { text: string }[] }[];
    };

    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]?.type).toBe("paragraph");
    expect(doc.content[0]?.content[0]?.text).toBe("Primeiro parágrafo.");
  });

  it("maps Heading styles to Tiptap headings", () => {
    const xml = `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Sub</w:t></w:r></w:p>
        </w:body>
      </w:document>`;
    const doc = docxXmlToTiptap(xml) as {
      content: { type: string; attrs: { level: number } }[];
    };

    expect(doc.content[0]?.type).toBe("heading");
    expect(doc.content[0]?.attrs.level).toBe(2);
  });

  it("maps indented paragraphs to blockquotes and Courier runs to code", () => {
    const xml = `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:pPr><w:ind w:left="480"/></w:pPr><w:r><w:t>Citado.</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:rFonts w:ascii="Courier New"/></w:rPr><w:t>code();</w:t></w:r></w:p>
        </w:body>
      </w:document>`;
    const doc = docxXmlToTiptap(xml) as {
      content: { type: string }[];
    };

    expect(doc.content[0]?.type).toBe("blockquote");
    expect(doc.content[1]?.type).toBe("codeBlock");
  });
});

describe("splitDocxChapters", () => {
  it("splits on level-1 headings and drops leading front-matter", () => {
    const doc = docxXmlToTiptap(`<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Romance</w:t></w:r></w:p>
          <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capítulo 1</w:t></w:r></w:p>
          <w:p><w:r><w:t>Era uma vez.</w:t></w:r></w:p>
          <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capítulo 2</w:t></w:r></w:p>
          <w:p><w:r><w:t>Fim.</w:t></w:r></w:p>
        </w:body>
      </w:document>`);

    const chapters = splitDocxChapters(doc, "Arquivo");

    expect(chapters.map((c) => c.title)).toEqual(["Capítulo 1", "Capítulo 2"]);
  });

  it("falls back to the filename when there are no headings", () => {
    const chapters = splitDocxChapters(docxXmlToTiptap(PARAGRAPH_DOC), "Meu arquivo");

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe("Meu arquivo");
  });
});

describe("importDocxFile (round-trip with buildDocxBlob)", () => {
  it("re-imports an exported DOCX with equivalent text", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const chapters: DocxChapterInput[] = [
      {
        title: "Capítulo 1",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Era uma vez, num lugar distante." }],
            },
          ],
        },
      },
      {
        title: "Capítulo 2",
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Subseção" }],
            },
            { type: "paragraph", content: [{ type: "text", text: "Fim do capítulo." }] },
          ],
        },
      },
    ];
    const blob = await buildDocxBlob(
      { title: "Romance", subtitle: "Um conto", author: "Ana" } as Project,
      chapters,
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const result = await importDocxFile(project.id, "romance.docx", bytes);

    expect(result.count).toBe(2);
    expect(result.titles).toEqual(["Capítulo 1", "Capítulo 2"]);

    const saved = await getDatabase()
      .chapters.filter((c) => c.projectId === project.id)
      .toArray();
    // Dexie `.filter().toArray()` returns primary-key (UUID) order — sort by
    // the chapter's narrative order to compare creation sequence.
    saved.sort((a, b) => a.order - b.order);
    expect(saved.map((c) => c.title)).toEqual(["Capítulo 1", "Capítulo 2"]);
    const text = JSON.stringify(saved[0]?.content);
    expect(text).toContain("Era uma vez, num lugar distante.");
  });

  it("rejects files without word/document.xml", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const bytes = docxBytes({ "word/other.xml": "<w:x/>" });

    await expect(importDocxFile(project.id, "x.docx", bytes)).rejects.toThrow(
      "word/document.xml",
    );
  });
});
