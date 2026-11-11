import { describe, expect, it } from "vitest";

import type { CustomPrompt } from "@/shared/types/database";

import { buildPromptExport, parsePromptExport } from "./prompt-io";

const prompt: CustomPrompt = {
  id: "p1",
  kind: "question",
  category: "enredo",
  variants: ["O que muda se {local} queimar?"],
  enabled: true,
  order: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildPromptExport", () => {
  it("empacota os prompts no envelope autor", () => {
    const output = buildPromptExport([prompt]);
    expect(output).toEqual({
      app: "autor",
      type: "prompts",
      formatVersion: 1,
      items: [prompt],
    });
  });
});

describe("parsePromptExport", () => {
  it("aceita um export válido", () => {
    expect(parsePromptExport(buildPromptExport([prompt]))).toEqual([prompt]);
  });

  it("rejeita envelopes de outros apps ou versões", () => {
    expect(() => parsePromptExport(null)).toThrow(/inválido/);
    expect(() =>
      parsePromptExport({ app: "outro", type: "prompts" }),
    ).toThrow(/inválido/);
    expect(() =>
      parsePromptExport({ app: "autor", type: "prompts", formatVersion: 2, items: [] }),
    ).toThrow(/inválido/);
    expect(() =>
      parsePromptExport({ app: "autor", type: "prompts", formatVersion: 1 }),
    ).toThrow(/inválido/);
  });

  it("rejeita item com kind inválido ou sem variantes", () => {
    expect(() =>
      parsePromptExport(
        buildPromptExport([{ ...prompt, kind: "sei-la" } as unknown as CustomPrompt]),
      ),
    ).toThrow(/posição 1/);
    expect(() =>
      parsePromptExport(buildPromptExport([{ ...prompt, variants: [] }])),
    ).toThrow(/posição 1/);
    expect(() =>
      parsePromptExport(
        buildPromptExport([{ ...prompt, variants: ["  "] }] as never),
      ),
    ).toThrow(/posição 1/);
  });

  it("rejeita pergunta sem categoria válida", () => {
    expect(() =>
      parsePromptExport(
        buildPromptExport([
          { ...prompt, category: "whatever" } as unknown as CustomPrompt,
        ]),
      ),
    ).toThrow(/categoria/);
    expect(() =>
      parsePromptExport(
        buildPromptExport([{ ...prompt, category: undefined }]),
      ),
    ).toThrow(/categoria/);
  });

  it("aceita whatIf sem categoria", () => {
    const whatIf: CustomPrompt = {
      ...prompt,
      id: "p2",
      kind: "whatIf",
      category: undefined,
    };
    expect(parsePromptExport(buildPromptExport([whatIf]))).toEqual([whatIf]);
  });
});
