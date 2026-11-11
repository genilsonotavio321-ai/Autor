import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { findTextRanges, previewForRange } from "./replace";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    heading: { group: "block", content: "inline*" },
    text: { group: "inline" },
    hardBreak: { inline: true, group: "inline" },
  },
});

function buildDoc(...blocks: string[]) {
  return schema.node(
    "doc",
    null,
    blocks.map((text) =>
      schema.node("paragraph", null, text ? [schema.text(text)] : []),
    ),
  );
}

describe("findTextRanges", () => {
  it("finds accented matches case-insensitively by default", () => {
    const ranges = findTextRanges(buildDoc("Água, água e ÁGUA."), "água");

    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ from: 1, to: 5 });
    expect(ranges[1]).toEqual({ from: 7, to: 11 });
    expect(ranges[2]).toEqual({ from: 14, to: 18 });
  });

  it("respects case when caseSensitive is set", () => {
    const ranges = findTextRanges(buildDoc("Água, água e ÁGUA."), "água", {
      caseSensitive: true,
    });

    expect(ranges).toEqual([{ from: 7, to: 11 }]);
  });

  it("returns the text around an occurrence for previews", () => {
    const doc = buildDoc("Oi Davi saiu.");
    const preview = previewForRange(doc, { from: 4, to: 8 });

    expect(preview.match).toBe("Davi");
    expect(preview.before).toBe("Oi ");
    expect(preview.after).toBe(" saiu.");
    expect(preview.truncatedStart).toBe(false);
    expect(preview.truncatedEnd).toBe(false);
  });

  it("flags clipped context on both sides", () => {
    const doc = buildDoc(`${"x".repeat(60)} Davi ${"y".repeat(60)}`);

    const preview = previewForRange(doc, { from: 62, to: 66 }, 10);

    expect(preview.match).toBe("Davi");
    expect(preview.before).toHaveLength(10);
    expect(preview.after).toHaveLength(10);
    expect(preview.truncatedStart).toBe(true);
    expect(preview.truncatedEnd).toBe(true);
  });

  it("returns every occurrence within a block", () => {
    const ranges = findTextRanges(buildDoc("um dois um dois"), "dois");

    expect(ranges).toEqual([
      { from: 4, to: 8 },
      { from: 12, to: 16 },
    ]);
  });

  it("never matches across two blocks", () => {
    expect(findTextRanges(buildDoc("abc", "def"), "cd")).toEqual([]);
  });

  it("maps positions per block, including headings", () => {
    const doc = schema.node("doc", null, [
      schema.node("heading", null, [schema.text("Cena um")]),
      schema.node("paragraph", null, [schema.text("um final")]),
    ]);

    expect(findTextRanges(doc, "um")).toEqual([
      { from: 6, to: 8 },
      { from: 10, to: 12 },
    ]);
  });

  it("treats the query as literal text", () => {
    const ranges = findTextRanges(buildDoc("Preço (R$) final"), "(R$)");

    expect(ranges).toEqual([{ from: 7, to: 11 }]);
  });

  it("returns nothing for an empty query", () => {
    expect(findTextRanges(buildDoc("qualquer texto"), "")).toEqual([]);
  });
});
