import { describe, expect, it } from "vitest";

import type { Json } from "@/shared/types/database";

import { countDocWords, countWords } from "./word-count";

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("era uma vez")).toBe(3);
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(countWords("  era   uma vez  ")).toBe(3);
  });

  it("returns 0 for empty or blank text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n ")).toBe(0);
  });
});

describe("countDocWords", () => {
  it("counts words across a Tiptap document", () => {
    const doc: Json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "era uma vez" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "um " },
            { type: "text", marks: [{ type: "bold" }], text: "herói" },
          ],
        },
      ],
    };
    expect(countDocWords(doc)).toBe(5);
  });

  it("returns 0 for an empty document", () => {
    expect(countDocWords({ type: "doc", content: [] })).toBe(0);
  });
});
