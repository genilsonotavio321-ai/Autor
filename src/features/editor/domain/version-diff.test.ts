import { describe, expect, it } from "vitest";

import type { Json } from "@/shared/types/database";

import { diffDocAgainstSnapshot, docToBlocks } from "./version-diff";

function doc(...nodes: Record<string, Json>[]): Json {
  return { type: "doc", content: nodes };
}

function paragraph(text: string): Record<string, Json> {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function heading(level: number, text: string): Record<string, Json> {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

describe("docToBlocks", () => {
  it("flattens headings and paragraphs with text", () => {
    const blocks = docToBlocks(
      doc(heading(2, "Capítulo"), paragraph("Era uma vez."), paragraph("")),
    );

    expect(blocks).toEqual([
      { kind: "heading", level: 2, text: "Capítulo" },
      { kind: "paragraph", text: "Era uma vez." },
      { kind: "paragraph", text: "" },
    ]);
  });

  it("concatenates inline text inside paragraphs", () => {
    const blocks = docToBlocks(
      doc({
        type: "paragraph",
        content: [
          { type: "text", text: "Olá " },
          {
            type: "text",
            text: "mundo",
            marks: [{ type: "bold" }],
          },
        ],
      }),
    );

    expect(blocks[0]?.text).toBe("Olá mundo");
  });

  it("emits list items with indentation for nesting", () => {
    const blocks = docToBlocks(
      doc({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [paragraph("Um")],
          },
          {
            type: "listItem",
            content: [
              paragraph("Dois"),
              {
                type: "bulletList",
                content: [{ type: "listItem", content: [paragraph("Sub")] }],
              },
            ],
          },
        ],
      }),
    );

    expect(blocks).toEqual([
      { kind: "list-item", text: "- Um" },
      { kind: "list-item", text: "- Dois" },
      { kind: "list-item", text: "  - Sub" },
    ]);
  });

  it("returns empty for null or malformed docs", () => {
    expect(docToBlocks(null)).toEqual([]);
    expect(docToBlocks({ type: "doc" })).toEqual([]);
    expect(docToBlocks("nope")).toEqual([]);
  });
});

describe("diffDocAgainstSnapshot", () => {
  it("marks everything as same for identical docs", () => {
    const current = doc(heading(1, "Título"), paragraph("Texto."));
    const lines = diffDocAgainstSnapshot(current, structuredClone(current));

    expect(lines.every((line) => line.type === "same")).toBe(true);
    expect(lines).toHaveLength(2);
  });

  it("marks editor-only paragraphs as removed (lost on restore)", () => {
    const snapshot = doc(paragraph("Original."));
    const current = doc(paragraph("Original."), paragraph("Novo depois."));

    const lines = diffDocAgainstSnapshot(current, snapshot);

    expect(lines.map((line) => [line.type, line.block.text])).toEqual([
      ["same", "Original."],
      ["removed", "Novo depois."],
    ]);
  });

  it("marks snapshot-only paragraphs as added (recovered on restore)", () => {
    const snapshot = doc(paragraph("Perdido."), paragraph("Original."));
    const current = doc(paragraph("Original."));

    const lines = diffDocAgainstSnapshot(current, snapshot);

    expect(
      lines.filter((line) => line.type !== "same").map((l) => [l.type, l.block.text]),
    ).toEqual([["added", "Perdido."]]);
  });

  it("treats a changed paragraph as removed + added", () => {
    const snapshot = doc(paragraph("Antes."));
    const current = doc(paragraph("Depois."));

    const lines = diffDocAgainstSnapshot(current, snapshot);

    expect(lines.map((line) => line.type)).toEqual(["removed", "added"]);
  });

  it("treats a heading level change as an edit even with equal text", () => {
    const snapshot = doc(heading(1, "Título"));
    const current = doc(heading(2, "Título"));

    const lines = diffDocAgainstSnapshot(current, snapshot);

    expect(lines.map((line) => line.type)).toEqual(["removed", "added"]);
    expect(lines[0]?.block.kind).toBe("heading");
    expect(lines[1]?.block.level).toBe(1);
  });

  it("keeps common lines around an insertion aligned (LCS)", () => {
    const snapshot = doc(paragraph("A"), paragraph("B"), paragraph("C"));
    const current = doc(paragraph("A"), paragraph("X"), paragraph("B"), paragraph("C"));

    const lines = diffDocAgainstSnapshot(current, snapshot);

    expect(
      lines.map((line) => `${line.type}:${line.block.text}`),
    ).toEqual(["same:A", "removed:X", "same:B", "same:C"]);
  });
});
