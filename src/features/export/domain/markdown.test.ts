import { describe, expect, it } from "vitest";

import { collapseWhitespace, extractDocText } from "@/shared/lib/text";
import type { Chapter, Json, Project, Scene } from "@/shared/types/database";

import {
  docToMarkdown,
  markdownToDoc,
  projectToMarkdown,
  splitMarkdownChapters,
} from "./markdown";

const now = "2026-01-01T00:00:00.000Z";

function doc(...content: Json[]): Json {
  return { type: "doc", content };
}

describe("docToMarkdown", () => {
  it("serializes headings, paragraphs and inline marks", () => {
    const output = docToMarkdown(
      doc(
        { type: "heading", level: 1, content: [{ type: "text", text: "Título" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Um " },
            { type: "text", text: "forte", marks: [{ type: "bold" }] },
            { type: "text", text: " e " },
            { type: "text", text: "ênfase", marks: [{ type: "italic" }] },
            { type: "text", text: "." },
          ],
        },
      ),
    );
    expect(output).toBe("# Título\n\nUm **forte** e *ênfase*.");
  });

  it("serializes bullet and ordered lists", () => {
    const output = docToMarkdown(
      doc(
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "um" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "dois" }] }] },
          ],
        },
        {
          type: "orderedList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "primeiro" }] }] },
          ],
        },
      ),
    );
    expect(output).toBe("- um\n- dois\n\n1. primeiro");
  });

  it("serializes blockquotes and code blocks", () => {
    const output = docToMarkdown(
      doc(
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "citação" }] }],
        },
        { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
      ),
    );
    expect(output).toBe("> citação\n\n```\nconst x = 1;\n```");
  });
});

describe("markdownToDoc", () => {
  it("parses headings, marks and lists", () => {
    const parsed = markdownToDoc("# Título\n\nUm **forte** e *ênfase*.\n\n- um\n- dois");
    expect(collapseWhitespace(extractDocText(parsed))).toBe(
      "Título Um forte e ênfase . um dois",
    );
    const blocks = (parsed as Record<string, Json>).content as Json[];
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[2]).toMatchObject({ type: "bulletList" });
  });

  it("round-trips doc → markdown → doc preserving text", () => {
    const original = doc(
      { type: "heading", level: 2, content: [{ type: "text", text: "Cena da caverna" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Ana " },
          { type: "text", text: "acenou", marks: [{ type: "italic" }] },
          { type: "text", text: " e partiu." },
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "espada" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "escudo" }] }] },
        ],
      },
    );
    const round = markdownToDoc(docToMarkdown(original));
    expect(extractDocText(round)).toBe(extractDocText(original));
  });
});

describe("projectToMarkdown + splitMarkdownChapters", () => {
  const project: Project = {
    id: "p1",
    title: "Romance",
    subtitle: "Uma jornada",
    author: "Ana",
    description: "Breve descrição.",
    status: "active",
    settings: {},
    createdAt: now,
    updatedAt: now,
  };

  function chapter(id: string, order: number, title: string): Chapter {
    return {
      id,
      projectId: "p1",
      title,
      order,
      status: "draft",
      wordCount: 0,
      content: doc({
        type: "paragraph",
        content: [{ type: "text", text: `Conteúdo de ${title}` }],
      }),
      createdAt: now,
      updatedAt: now,
    };
  }

  it("emits front matter, ordered chapters and scenes", () => {
    const scene: Scene = {
      id: "s1",
      chapterId: "c1",
      title: "Abertura",
      order: 1,
      status: "todo",
      summary: "Resumo da cena",
      content: doc({ type: "paragraph", content: [{ type: "text", text: "Ação inicial" }] }),
      createdAt: now,
      updatedAt: now,
    };
    const md = projectToMarkdown({
      project,
      chapters: [chapter("c2", 2, "Dois"), chapter("c1", 1, "Um")],
      scenesByChapter: new Map([["c1", [scene]]]),
    });
    expect(md).toContain("# Romance");
    expect(md).toContain("Autor: Ana");
    expect(md.indexOf("# 1. Um")).toBeLessThan(md.indexOf("# 2. Dois"));
    expect(md).toContain("## Cena 1: Abertura");
    expect(md).toContain("Resumo da cena");
  });

  it("splits an export back into chapters, dropping front matter", () => {
    const md = projectToMarkdown({
      project,
      chapters: [chapter("c1", 1, "Um"), chapter("c2", 2, "Dois")],
    });
    const chunks = splitMarkdownChapters(md);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.title).toBe("Um");
    expect(chunks[1]?.title).toBe("Dois");
    expect(extractDocText(markdownToDoc(chunks[1]!.markdown))).toContain(
      "Conteúdo de Dois",
    );
  });

  it("treats a file without headings as a single untitled chapter", () => {
    const chunks = splitMarkdownChapters("Só texto, sem títulos.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.title).toBe("");
    expect(chunks[0]?.markdown).toContain("Só texto");
  });
});
