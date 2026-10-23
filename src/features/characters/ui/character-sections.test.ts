import { describe, expect, it } from "vitest";

import type { Character, Tag } from "@/shared/types/database";

import { buildCharacterSections } from "./character-sections";

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "char-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    projectId: "project-1",
    name: "Aurora",
    role: "protagonist",
    traits: [],
    relationships: [],
    tags: [],
    ...overrides,
  };
}

function tag(id: string, name: string): Tag {
  return { id, projectId: "project-1", name };
}

const value = (sections: { label: string; value: string }[], label: string) =>
  sections.find((section) => section.label === label)?.value;

describe("buildCharacterSections", () => {
  it("usa os rótulos e valores salvos, na ordem da ficha", () => {
    const sections = buildCharacterSections(
      character({
        role: "antagonist",
        description: "Protagonista da história",
        backstory: "Cresceu no porto",
        goals: "Reencontrar o irmão",
        fears: "Água funda",
        traits: ["corajosa", "teimosa"],
      }),
      {
        tags: [tag("tag-1", "Elenco")],
        characters: [character({ id: "char-2", name: "Bento" })],
      },
    );

    expect(sections.map((section) => section.label)).toEqual([
      "Papel",
      "Descrição",
      "História",
      "Objetivos",
      "Medos",
      "Traços",
    ]);
    expect(value(sections, "Papel")).toBe("Antagonista");
    expect(value(sections, "Traços")).toBe("corajosa, teimosa");
  });

  it("omite seções sem conteúdo", () => {
    const sections = buildCharacterSections(character());

    expect(sections.map((section) => section.label)).toEqual(["Papel"]);
  });

  it("mostra o gênero quando definido", () => {
    const sections = buildCharacterSections(character({ gender: "feminino" }));

    expect(sections.map((section) => section.label)).toEqual([
      "Papel",
      "Gênero",
    ]);
    expect(value(sections, "Gênero")).toBe("Feminino");
  });

  it("resolve nomes das relações, tipo em português e nota", () => {
    const sections = buildCharacterSections(
      character({
        relationships: [
          { targetId: "char-2", type: "family", note: "irmã" },
          { targetId: "char-3", type: "enemy" },
          { targetId: "sumiu", type: "other" },
        ],
      }),
      { characters: [character({ id: "char-2", name: "Bento" })] },
    );

    expect(value(sections, "Relações")).toBe(
      "Bento — Família (irmã)\nPersonagem — Inimizade\nPersonagem — Outro",
    );
  });

  it("resolve as tags salvas e ignora ids desconhecidos", () => {
    const sections = buildCharacterSections(
      character({ tags: ["tag-1", "tag-2"] }),
      { tags: [tag("tag-1", "Elenco")] },
    );

    expect(value(sections, "Tags")).toBe("Elenco");
  });
});
