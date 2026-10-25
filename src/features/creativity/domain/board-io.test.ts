import { describe, expect, it } from "vitest";

import type { IdeaBoardItem } from "@/shared/types/database";

import { buildBoardExport, parseBoardExport } from "./board-io";

const items: IdeaBoardItem[] = [
  {
    key: "card-1",
    title: "Desbloqueio · Enredo",
    content: "E se a heroína traísse o mentor?",
    color: "yellow",
    x: 16,
    y: 32,
  },
  {
    key: "card-2",
    title: "Vilão",
    content: "",
    x: 300,
    y: 120,
    links: ["card-1"],
  },
];

describe("board-io", () => {
  it("empacota o canvas no envelope de exportação", () => {
    const exported = buildBoardExport(items);
    expect(exported).toEqual({
      app: "autor",
      type: "idea-canvas",
      formatVersion: 1,
      items,
    });
  });

  it("aceita um roundtrip de exportação e leitura", () => {
    const parsed = parseBoardExport(buildBoardExport(items));
    expect(parsed).toEqual(items);
  });

  it("rejeita envelope errado (app, type, versão ou itens ausentes)", () => {
    expect(() =>
      parseBoardExport({ app: "outro", type: "idea-canvas", formatVersion: 1 }),
    ).toThrow("Arquivo de quadro inválido");
    expect(() =>
      parseBoardExport({ app: "autor", type: "prompts", formatVersion: 1, items: [] }),
    ).toThrow("Arquivo de quadro inválido");
    expect(() =>
      parseBoardExport({ app: "autor", type: "idea-canvas", formatVersion: 2, items: [] }),
    ).toThrow("Arquivo de quadro inválido");
    expect(() =>
      parseBoardExport({ app: "autor", type: "idea-canvas", formatVersion: 1 }),
    ).toThrow("Arquivo de quadro inválido");
  });

  it("rejeita item sem key, com coordenada inválida ou links não-string", () => {
    const exported = buildBoardExport(items);
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[0], key: " " }] }),
    ).toThrow("Item inválido na posição 1");
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[0], x: Number.NaN }] }),
    ).toThrow("Item inválido na posição 1");
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[1], links: [42] }] }),
    ).toThrow("Item inválido na posição 1");
  });

  it("aceita item sem links e sem cor", () => {
    const parsed = parseBoardExport({
      app: "autor",
      type: "idea-canvas",
      formatVersion: 1,
      items: [{ key: "k", title: "T", content: "", x: 0, y: 0 }],
    });
    expect(parsed).toHaveLength(1);
  });

  it("exporta e lê nodes de ficha com tamanho (w/h/refType/refId)", () => {
    const rich: IdeaBoardItem[] = [
      {
        key: "card-1",
        title: "Desbloqueio · Enredo",
        content: "E se a heroína traísse o mentor?",
        color: "yellow",
        x: 16,
        y: 32,
        w: 320,
        h: 200,
        refType: "character",
        refId: "char-9",
        doc: { type: "doc", content: [] },
      },
    ];
    expect(parseBoardExport(buildBoardExport(rich))).toEqual(rich);
  });

  it("rejeita w/h/refType/refId/doc inválidos nos itens", () => {
    const exported = buildBoardExport(items);
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[0], w: "42" }] }),
    ).toThrow("Item inválido na posição 1");
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[0], refType: "item" }] }),
    ).toThrow("Item inválido na posição 1");
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[0], refId: 7 }] }),
    ).toThrow("Item inválido na posição 1");
    expect(() =>
      parseBoardExport({ ...exported, items: [{ ...items[0], doc: 7 }] }),
    ).toThrow("Item inválido na posição 1");
  });
});
