import { describe, expect, it } from "vitest";

import type { Json } from "@/shared/types/database";

import { buildPdf } from "./pdf-export";

function doc(blocks: unknown[]): Json {
  return { type: "doc", content: blocks } as unknown as Json;
}

function paragraph(text: string, textAlign?: string) {
  return {
    type: "paragraph",
    ...(textAlign ? { attrs: { textAlign } } : {}),
    content: [{ type: "text", text }],
  };
}

function build(content: Json): Blob {
  return buildPdf({
    title: "Título",
    cover: false,
    chapters: [{ title: "Capítulo", content }],
  });
}

async function stream(content: Json): Promise<string> {
  const bytes = new Uint8Array(await build(content).arrayBuffer());
  return new TextDecoder("latin1").decode(bytes);
}

/** X offsets of every text run in the content stream (jsPDF emits `x y Td`). */
function textXs(pdf: string): number[] {
  return [...pdf.matchAll(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?) Td/g)].map((match) =>
    Number(match[1]),
  );
}

describe("buildPdf — alinhamento (item 11)", () => {
  it("posiciona o texto conforme textAlign", async () => {
    const left = await stream(doc([paragraph("Alinhado", "left")]));
    const center = await stream(doc([paragraph("Alinhado", "center")]));
    const right = await stream(doc([paragraph("Alinhado", "right")]));
    const justify = await stream(doc([paragraph("Alinhado", "justify")]));

    // left/justify ancoram na margem; center/right deslocam para a direita.
    expect(Math.max(...textXs(center))).toBeGreaterThan(Math.max(...textXs(left)));
    expect(Math.max(...textXs(right))).toBeGreaterThan(Math.max(...textXs(left)));
    expect(justify).not.toBe("");
  });

  it("mantém o texto de um parágrafo centralizado", async () => {
    const centered = await stream(doc([paragraph("Centro", "center")]));
    expect(centered).toContain("(Centro) Tj");
  });
});

describe("buildPdf — separador de parágrafo (item 9)", () => {
  it("desenha uma linha visível para horizontalRule", async () => {
    const withRule = await stream(
      doc([paragraph("Antes"), { type: "horizontalRule" }, paragraph("Depois")]),
    );
    const withoutRule = await stream(doc([paragraph("Antes"), paragraph("Depois")]));

    expect(withRule).not.toBe(withoutRule);
    // Operador de linha do jsPDF (m = move, l = line).
    expect(withRule).toMatch(/[\d.]+ [\d.]+ m\s+[\d.]+ [\d.]+ l/);
  });
});

describe("buildPdf — citações e listas (item 11)", () => {
  it("escreve citações e itens aninhados", async () => {
    const pdf = await stream(
      doc([
        { type: "blockquote", content: [paragraph("Citacao")] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                paragraph("ItemA"),
                {
                  type: "bulletList",
                  content: [{ type: "listItem", content: [paragraph("ItemB")] }],
                },
              ],
            },
          ],
        },
      ]),
    );

    expect(pdf).toContain("(Citacao) Tj");
    expect(pdf).toContain("(- ItemA) Tj");
    // A lista aninhada não é mais achatada na linha do pai.
    expect(pdf).toContain("(- ItemB) Tj");
  });
});

/** Fonts used for the body text (12pt) — the chapter title uses 20pt. */
function bodyFonts(pdf: string): Set<string> {
  return new Set([...pdf.matchAll(/\/(\w+) 12 Tf/g)].map((match) => match[1]!));
}

function styledParagraph() {
  return {
    type: "paragraph",
    content: [
      { type: "text", text: "Normal " },
      { type: "text", text: "Negrito", marks: [{ type: "bold" }] },
      { type: "text", text: " e " },
      { type: "text", text: "Italico", marks: [{ type: "italic" }] },
      { type: "text", text: " fim." },
    ],
  };
}

describe("buildPdf — negrito e itálico", () => {
  it("usa uma fonte diferente para os trechos marcados", async () => {
    const plain = await stream(
      doc([paragraph("Normal Negrito e Italico fim.")]),
    );
    const styled = await stream(doc([styledParagraph()]));

    // Sem marcações o corpo usa uma única fonte; com marcações, três.
    expect(bodyFonts(plain).size).toBe(1);
    expect(bodyFonts(styled).size).toBe(3);
    expect(styled).toContain("(Negrito) Tj");
    expect(styled).toContain("(Italico) Tj");
  });

  it("combina negrito e itálico num mesmo trecho", async () => {
    const plain = await stream(doc([paragraph("Texto")]));
    const both = await stream(
      doc([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Antes " },
            {
              type: "text",
              text: "Ambos",
              marks: [{ type: "bold" }, { type: "italic" }],
            },
          ],
        },
      ]),
    );

    const extra = [...bodyFonts(both)].filter(
      (font) => !bodyFonts(plain).has(font),
    );
    expect(extra).toHaveLength(1);
    expect(both).toContain("(Ambos) Tj");
  });
});

describe("buildPdf — justificado", () => {
  it("espalha as palavras das linhas não finais", async () => {
    const long =
      "Alinhamento justificado precisa distribuir o espaco entre as palavras " +
      "de cada linha que nao e a ultima, empurrando a margem direita para o limite.";
    const left = await stream(doc([paragraph(long, "left")]));
    const justify = await stream(doc([paragraph(long, "justify")]));

    const texts = (pdf: string) => [...pdf.matchAll(/\) Tj/g)].length;

    // À esquerda cada linha sai como um único operador; justificada sai
    // palavra por palavra (os espaços extra são calculados entre elas).
    expect(texts(justify)).toBeGreaterThan(texts(left));
    expect(justify).not.toBe(left);
  });
});

describe("buildPdf — documento misto (fixture do layout simplificado)", () => {
  it("renderiza títulos, estilos, citação, listas e alinhamentos juntos", async () => {
    const pdf = await stream(
      doc([
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "TituloUm" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "TituloDois" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "TituloTres" }],
        },
        paragraph("ParagrafoCentro", "center"),
        paragraph("ParagrafoDireita", "right"),
        styledParagraph(),
        { type: "blockquote", content: [paragraph("CitacaoMista")] },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph("ItemMarcado")] }],
        },
        {
          type: "orderedList",
          content: [{ type: "listItem", content: [paragraph("ItemNumerado")] }],
        },
      ]),
    );

    // H1–H3 saem nos corpos 20/16/14 (o corpo do texto é 12).
    expect(pdf).toMatch(/\b20 Tf\b/);
    expect(pdf).toMatch(/\b16 Tf\b/);
    expect(pdf).toMatch(/\b14 Tf\b/);
    expect(pdf).toContain("(TituloUm) Tj");
    expect(pdf).toContain("(TituloDois) Tj");
    expect(pdf).toContain("(TituloTres) Tj");
    // Estilos inline e blocos especiais.
    expect(pdf).toContain("(Negrito) Tj");
    expect(pdf).toContain("(Italico) Tj");
    expect(pdf).toContain("(CitacaoMista) Tj");
    expect(pdf).toContain("(- ItemMarcado) Tj");
    expect(pdf).toContain("(1. ItemNumerado) Tj");
    // Alinhamentos diferentes convivem no mesmo documento.
    expect(pdf).toContain("(ParagrafoCentro) Tj");
    expect(pdf).toContain("(ParagrafoDireita) Tj");
  });
});
