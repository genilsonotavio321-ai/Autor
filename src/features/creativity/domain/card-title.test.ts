import { describe, expect, it } from "vitest";

import { titleFromPlain } from "./card-title";

describe("titleFromPlain", () => {
  it("usa a primeira linha não vazia", () => {
    expect(titleFromPlain("O labirinto\nresto do texto")).toBe("O labirinto");
    expect(titleFromPlain("\n  \n\nSegunda linha")).toBe("Segunda linha");
  });

  it("cai em Sem título quando o texto é vazio", () => {
    expect(titleFromPlain("")).toBe("Sem título");
    expect(titleFromPlain("   \n \n")).toBe("Sem título");
  });

  it("encurta linhas longas preservando o começo", () => {
    const title = titleFromPlain("x".repeat(80));
    expect(title).toBe(`${"x".repeat(60)}…`);
  });
});
