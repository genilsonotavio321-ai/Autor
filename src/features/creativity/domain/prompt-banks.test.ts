import { describe, expect, it } from "vitest";

import type { Character, Location } from "@/shared/types/database";

import {
  PROMPT_BANKS,
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  WHAT_IF_OBSTACLES,
  WHAT_IF_SETTINGS,
  WHAT_IF_SUBJECTS,
  drawFrom,
  drawPrompt,
  drawWhatIf,
} from "./prompt-banks";

describe("prompt banks", () => {
  it("has a pt-BR label and a non-empty bank per category", () => {
    expect(PROMPT_CATEGORIES).toEqual([
      "enredo",
      "personagem",
      "mundo",
      "conflito",
    ]);
    for (const category of PROMPT_CATEGORIES) {
      expect(PROMPT_BANKS[category].length).toBeGreaterThan(3);
      expect(PROMPT_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
      for (const question of PROMPT_BANKS[category]) {
        expect(question.trim()).not.toBe("");
      }
      // Sem duplicatas dentro do banco.
      expect(new Set(PROMPT_BANKS[category]).size).toBe(
        PROMPT_BANKS[category].length,
      );
    }
  });

  it("has non-empty unique entries in every 'e se' axis", () => {
    for (const axis of [
      WHAT_IF_SUBJECTS,
      WHAT_IF_OBSTACLES,
      WHAT_IF_SETTINGS,
    ]) {
      expect(axis.length).toBeGreaterThan(1);
      expect(new Set(axis).size).toBe(axis.length);
      for (const item of axis) expect(item.trim()).not.toBe("");
    }
  });
});

describe("drawFrom", () => {
  const items = ["a", "b", "c"];

  it("is deterministic via modulo", () => {
    expect(drawFrom(items, 0)).toBe("a");
    expect(drawFrom(items, 3)).toBe("a");
    expect(drawFrom(items, 4)).toBe("b");
    expect(drawFrom(items, 5)).toBe("c");
    expect(drawFrom(items, -1)).toBe("c");
  });

  it("never repeats the last draw when possible", () => {
    expect(drawFrom(items, 0, "a")).toBe("b");
    expect(drawFrom(items, 1, "a")).toBe("b");
  });
});

describe("drawPrompt / drawWhatIf", () => {
  it("draws a prompt from the chosen bank", () => {
    const bank = PROMPT_BANKS.enredo;
    expect(bank).toContain(drawPrompt("enredo", 2));
  });

  it("composes 'E se...' from the three axes", () => {
    const text = drawWhatIf(0);
    expect(text).toBe(
      `E se ${WHAT_IF_SUBJECTS[0]} ${WHAT_IF_OBSTACLES[1]}, ${WHAT_IF_SETTINGS[2]}?`,
    );
    expect(text.endsWith("?")).toBe(true);
  });

  it("never repeats the last 'E se...'", () => {
    const first = drawWhatIf(0);
    const second = drawWhatIf(0, first);
    expect(second).not.toBe(first);
  });
});

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "char-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    projectId: "p-1",
    name: "Aurora",
    role: "protagonist",
    traits: [],
    relationships: [],
    tags: [],
    ...overrides,
  };
}

describe("gerador com personagens", () => {
  it("usa a ficha como sujeito e concorda o gênero", () => {
    // seed 3 → obstáculo "fosse obrigad@ a voltar..." (índice 4).
    expect(drawWhatIf(3, undefined, [character({ gender: "feminino" })])).toBe(
      "E se Aurora fosse obrigada a voltar ao lugar que jurou nunca mais pisar, na véspera da batalha final?",
    );
    expect(
      drawWhatIf(3, undefined, [
        character({ name: "Bento", gender: "masculino" }),
      ]),
    ).toBe(
      "E se Bento fosse obrigado a voltar ao lugar que jurou nunca mais pisar, na véspera da batalha final?",
    );
  });

  it("gênero indefinido ou 'outro' nunca recebe template com marcador", () => {
    const noGender = character({ gender: undefined });
    const other = character({ gender: "outro" });
    for (let seed = 0; seed < 36; seed++) {
      expect(drawWhatIf(seed, undefined, [noGender])).not.toContain("@");
      expect(drawWhatIf(seed, undefined, [other])).not.toContain("@");
    }
  });

  it("sem personagens mantém o comportamento atual (@ vira 'o')", () => {
    expect(drawWhatIf(3)).toContain("fosse obrigado a voltar");
    expect(drawWhatIf(3)).not.toContain("@");
  });

  it("substitui {personagem} pelo nome da ficha sorteada", () => {
    // seed 6 cai no banco de personagens (6 base + 3 com placeholder).
    const question = drawPrompt("personagem", 6, undefined, [character()]);
    expect(question).not.toContain("{personagem}");
    expect(question).toContain("Aurora");
  });

  it("é determinístico e não repete o último resultado", () => {
    const aurora = [character({ gender: "feminino" })];
    expect(drawWhatIf(3, undefined, aurora)).toBe(
      drawWhatIf(3, undefined, aurora),
    );
    const first = drawWhatIf(0, undefined, aurora);
    expect(drawWhatIf(0, first, aurora)).not.toBe(first);
  });

  it("substitui {personagem} e {local} em variantes customizadas do e se", () => {
    const taverna: Location = {
      id: "loc-1",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      projectId: "p-1",
      name: "Taverna do Porco",
      type: "povoado",
      tags: [],
    };
    const bento = [character({ name: "Bento", gender: "masculino" })];
    // seed 5 → roll 0,05 < peso 0,5 → pool custom (obstáculo) vira o eixo.
    const text = drawWhatIf(
      5,
      undefined,
      bento,
      ["descobrisse que {personagem} o traía em {local}"],
      [taverna],
    );
    expect(text).toBe(
      "E se Bento descobrisse que Bento o traía em Taverna do Porco, diante de todos os aliados?",
    );
  });

  it("variante com placeholder sem ficha/local correspondente fica fora", () => {
    const text = drawWhatIf(
      5,
      undefined,
      [],
      ["{personagem} faria algo em {local}"],
    );
    expect(text).not.toContain("{personagem}");
    expect(text).not.toContain("{local}");
  });

  it("peso 0 nunca sorteia variante custom e peso 1 sempre sorteia", () => {
    const custom = ["descobrisse um segredo antigo"];
    // seed 5 → roll 0,05: peso 0 vai pro embutido, peso 1 vai pro custom.
    expect(drawWhatIf(5, undefined, undefined, custom, undefined, 0)).toBe(
      "E se o protagonista descobrisse que a pessoa em quem mais confia mente desde o início, diante de todos os aliados?",
    );
    expect(drawWhatIf(5, undefined, undefined, custom, undefined, 1)).toBe(
      "E se o protagonista descobrisse um segredo antigo, diante de todos os aliados?",
    );
    expect(
      drawPrompt("enredo", 5, undefined, undefined, undefined, custom, 0),
    ).toContain("O que aconteceria se o protagonista falhasse");
    expect(
      drawPrompt("enredo", 5, undefined, undefined, undefined, custom, 1),
    ).toBe("descobrisse um segredo antigo");
  });

  it("variante custom que já começa com 'E se' vira a frase inteira", () => {
    const text = drawWhatIf(
      5,
      undefined,
      [character({ name: "Bento", gender: "masculino" })],
      ["E se {personagem} sumisse sem deixar rastro em {local}?"],
      [
        {
          id: "loc-1",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
          projectId: "p-1",
          name: "Taverna do Porco",
          type: "povoado",
          tags: [],
        },
      ],
      1,
    );
    expect(text).toBe("E se Bento sumisse sem deixar rastro em Taverna do Porco?");
  });
});
