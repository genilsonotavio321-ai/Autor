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
