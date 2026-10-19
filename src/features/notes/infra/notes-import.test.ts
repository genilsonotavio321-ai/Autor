import { describe, expect, it } from "vitest";

import {
  parseNotesFile,
  parseNotesMarkdown,
  parseNotesText,
} from "./notes-import";

describe("parseNotesMarkdown", () => {
  it("reads one note per level-2 heading (round-trip with notesToMd)", () => {
    const text = [
      "## Ideias",
      "",
      "Primeira nota.",
      "Segunda linha.",
      "",
      "## Arco do vilão",
      "",
      "Ele trai o herói.",
      "",
    ].join("\n");

    expect(parseNotesMarkdown(text)).toEqual([
      { title: "Ideias", content: "Primeira nota.\nSegunda linha." },
      { title: "Arco do vilão", content: "Ele trai o herói." },
    ]);
  });

  it("keeps text before the first heading as an untitled note", () => {
    const text = "Solto no topo.\n\n## Título\n\nCorpo.";
    expect(parseNotesMarkdown(text)).toEqual([
      { content: "Solto no topo." },
      { title: "Título", content: "Corpo." },
    ]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseNotesMarkdown("")).toEqual([]);
    expect(parseNotesMarkdown("\n\n  \n")).toEqual([]);
  });
});

describe("parseNotesText", () => {
  it("reads one note per blank-line-separated block", () => {
    const text = "Título A\nCorpo A\n\nTítulo B\n\nTítulo C\nCorpo C";
    expect(parseNotesText(text)).toEqual([
      { title: "Título A", content: "Corpo A" },
      { title: "Título B", content: "" },
      { title: "Título C", content: "Corpo C" },
    ]);
  });

  it("ignores CRLF and blank blocks", () => {
    const text = "A\r\n\r\n\r\nB\r\n";
    expect(parseNotesText(text)).toEqual([
      { title: "A", content: "" },
      { title: "B", content: "" },
    ]);
  });
});

describe("parseNotesFile", () => {
  it("routes .md to the heading parser and .txt to the block parser", () => {
    expect(parseNotesFile("notas.md", "## X\n\ny")).toEqual([
      { title: "X", content: "y" },
    ]);
    expect(parseNotesFile("notas.txt", "X\n\ny")).toEqual([
      { title: "X", content: "" },
      { title: "y", content: "" },
    ]);
  });
});
