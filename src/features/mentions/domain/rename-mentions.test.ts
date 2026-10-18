import { describe, expect, it } from "vitest";

import type { Json } from "@/shared/types/database";

import { renameMentionsInContent } from "./rename-mentions";

function docWithText(text: string): Json {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function textOf(doc: Json): string {
  const content = (doc as { content: { content: { text: string }[] }[] })
    .content;
  return content[0]?.content[0]?.text ?? "";
}

describe("renameMentionsInContent", () => {
  it("rewrites every whole-word occurrence, preserving case", () => {
    const { content, count } = renameMentionsInContent(
      docWithText("Davi chegou. davi saiu. DAVI voltou."),
      "Davi",
      "Davi Silva",
    );
    expect(count).toBe(3);
    expect(textOf(content)).toBe(
      "Davi Silva chegou. davi silva saiu. DAVI SILVA voltou.",
    );
  });

  it("does not double the name when the text already has the new one", () => {
    const { content, count } = renameMentionsInContent(
      docWithText("Davi Silva chegou."),
      "Davi",
      "Davi Silva",
    );
    expect(count).toBe(0);
    expect(textOf(content)).toBe("Davi Silva chegou.");
  });

  it("respects word boundaries and accents", () => {
    const { count } = renameMentionsInContent(
      docWithText("Davirado viu Davi. Andréa olhou."),
      "Davi",
      "Davi Silva",
    );
    expect(count).toBe(1);
    const accented = renameMentionsInContent(
      docWithText("Andréa e andréa"),
      "Andréa",
      "Andréa Souza",
    );
    expect(accented.count).toBe(2);
  });

  it("is a no-op for short or equal names", () => {
    const doc = docWithText("Al chegou.");
    expect(renameMentionsInContent(doc, "Al", "Alberto").count).toBe(1);
    expect(renameMentionsInContent(doc, "A", "Alberto").count).toBe(0);
    expect(renameMentionsInContent(doc, "Al", "Al").count).toBe(0);
  });

  it("keeps the text node structure and marks intact", () => {
    const doc: Json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Oi ", marks: [] },
            { type: "text", text: "Davi", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const { content, count } = renameMentionsInContent(doc, "Davi", "Ana");
    expect(count).toBe(1);
    const nodes = (content as { content: { content: Json[] }[] }).content[0]
      ?.content;
    expect(nodes?.[1]).toEqual({
      type: "text",
      text: "Ana",
      marks: [{ type: "bold" }],
    });
  });

  it("does not mutate the input document", () => {
    const doc = docWithText("Davi chegou.");
    renameMentionsInContent(doc, "Davi", "Davi Silva");
    expect(textOf(doc)).toBe("Davi chegou.");
  });
});
