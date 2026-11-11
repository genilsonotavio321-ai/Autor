import { describe, expect, it } from "vitest";

import { detectTextIssues } from "./review";

function issues(text: string) {
  return detectTextIssues(text);
}

describe("detectTextIssues", () => {
  it("flags a repeated word", () => {
    const found = issues("eu vi o o gato");
    const repeated = found.filter((i) => i.type === "repeated-word");
    expect(repeated).toHaveLength(1);
    const first = repeated[0];
    expect(first?.suggestion).toBe("o");
    expect("eu vi o o gato".slice(first?.from, first?.to)).toBe("o o");
  });

  it("flags different repeated words", () => {
    expect(issues("de de nada")).toHaveLength(1);
    expect(issues("que que dia")).toHaveLength(1);
  });

  it("flags repeated words ignoring case", () => {
    const found = issues("O o gato saiu");
    const repeated = found.find((i) => i.type === "repeated-word");
    expect(repeated).toBeDefined();
    expect(repeated?.suggestion).toBe("O");
  });

  it("does not flag different words that share a prefix", () => {
    expect(issues("o orfanato")).toHaveLength(0);
  });

  it("flags double spaces between words", () => {
    const found = issues("ela  correu rápido");
    const spacing = found.filter((i) => i.type === "spacing");
    expect(spacing).toHaveLength(1);
    expect(spacing[0]?.suggestion).toBe(" ");
  });

  it("flags a space before punctuation", () => {
    const found = issues("ela chegou , tarde");
    const punct = found.find((i) => i.type === "punctuation");
    expect(punct).toBeDefined();
    expect(punct?.suggestion).toBe(",");
  });

  it("flags doubled punctuation but keeps ellipses", () => {
    expect(issues("no fim..")).toHaveLength(1);
    expect(issues("no fim...")).toHaveLength(0);
  });

  it("reports issues sorted by position", () => {
    const found = issues("ola o o mundo , assim");
    const positions = found.map((i) => i.from);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
