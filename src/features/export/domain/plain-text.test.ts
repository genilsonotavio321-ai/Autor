import { describe, expect, it } from "vitest";

import type { Json, Note } from "@/shared/types/database";

import {
  chapterToMd,
  chapterToTxt,
  notesToMd,
  notesToTxt,
  plainTextToDoc,
} from "./plain-text";

function doc(...paragraphs: Array<{ text: string; bold?: boolean }>): Json {
  return {
    type: "doc",
    content: paragraphs.map(({ text, bold }): Json => ({
      type: "paragraph",
      content: [
        bold
          ? { type: "text", text, marks: [{ type: "bold" }] }
          : { type: "text", text },
      ],
    })),
  };
}

function makeNote(title: string, content: string): Note {
  return {
    id: `note-${title}`,
    projectId: "p1",
    title,
    content,
    pinned: false,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("chapterToTxt / chapterToMd", () => {
  it("renders the title and body as plain text", () => {
    const chapter = {
      title: "Capítulo 1",
      content: doc({ text: "Era uma vez." }, { text: "Fim." }),
    };
    expect(chapterToTxt(chapter)).toBe(
      "Capítulo 1\n\nEra uma vez.\n\nFim.\n",
    );
  });

  it("renders markdown with a level-1 heading and marks", () => {
    const chapter = {
      title: "Capítulo 1",
      content: doc({ text: "negrito" }, { text: "Importante", bold: true }),
    };
    expect(chapterToMd(chapter)).toBe(
      "# Capítulo 1\n\nnegrito\n\n**Importante**\n",
    );
  });

  it("falls back to the body when the title is empty", () => {
    expect(chapterToTxt({ title: "", content: doc({ text: "Só texto." }) })).toBe(
      "Só texto.\n",
    );
    expect(chapterToMd({ title: "", content: doc({ text: "Só texto." }) })).toBe(
      "Só texto.\n",
    );
  });
});

describe("notesToTxt / notesToMd", () => {
  const notes = [
    makeNote("Ideia", "Um encontro à meia-noite."),
    makeNote("Revisar", ""),
  ];

  it("joins notes with a blank line, keeping title-only notes", () => {
    expect(notesToTxt(notes)).toBe(
      "Ideia\n\nUm encontro à meia-noite.\n\nRevisar\n",
    );
  });

  it("uses level-2 headings in Markdown", () => {
    expect(notesToMd(notes)).toBe(
      "## Ideia\n\nUm encontro à meia-noite.\n\n## Revisar\n",
    );
  });

  it("returns an empty string for no notes", () => {
    expect(notesToTxt([])).toBe("");
    expect(notesToMd([])).toBe("");
  });
});

describe("plainTextToDoc", () => {
  it("splits paragraphs on blank lines and keeps inner newlines as breaks", () => {
    expect(plainTextToDoc("Primeiro\r\nlinha 2\n\nSegundo")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Primeiro" },
            { type: "hardBreak" },
            { type: "text", text: "linha 2" },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Segundo" }],
        },
      ],
    });
  });

  it("returns an empty document for empty text", () => {
    expect(plainTextToDoc("   \n\n  ")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
