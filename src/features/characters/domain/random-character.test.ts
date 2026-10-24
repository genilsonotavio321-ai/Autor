import { describe, expect, it } from "vitest";

import type { Character } from "@/shared/types/database";

import { FEMALE_NAMES, MALE_NAMES } from "./random-character";
import { buildRandomCharacter } from "./random-character";

/** Fila cíclica de valores — random injetado e determinístico. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index = (index + 1) % values.length;
    return value;
  };
}

function makeCharacter(id: string, name: string): Character {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    projectId: "p-1",
    name,
    role: "supporting",
    traits: [],
    relationships: [],
    tags: [],
  };
}

describe("buildRandomCharacter", () => {
  it("monta a mesma ficha para a mesma sequência de sorteios", () => {
    const draws = [0.5, 0.9, 0.4, 0.1, 0.2, 0.5, 0.7, 0.75];
    const first = buildRandomCharacter([], sequence(draws));
    const second = buildRandomCharacter([], sequence(draws));

    expect(second).toEqual(first);
    expect(first.name).not.toBe("");
    expect(FEMALE_NAMES).toContain(first.name);
    expect(first.gender).toBe("feminino");
    expect(first.role).toBe("minor");
    expect(first.description).not.toBe("");
    expect(first.backstory).not.toBe("");
    expect(first.goals).not.toBe("");
    expect(first.fears).not.toBe("");
    expect(first.traits).toHaveLength(3);
    expect(first.relationships).toEqual([]);
  });

  it("não repete o nome de uma ficha existente", () => {
    const existing = [makeCharacter("c-1", "Aurêlio")];
    // Toda a fila em 0: gênero masculino, nome MALE_NAMES[0] = "Aurêlio" sempre.
    const character = buildRandomCharacter(existing, sequence([0]));

    expect(character.gender).toBe("masculino");
    expect(character.name).toBe("Aurêlio II");
  });

  it("cria relações apenas com fichas existentes", () => {
    const none = buildRandomCharacter([], sequence([0.5]));
    expect(none.relationships).toEqual([]);

    const existing = [makeCharacter("c-1", "Bento"), makeCharacter("c-2", "Helena")];
    const character = buildRandomCharacter(existing, sequence([0.2, 0.1, 0.6, 0.9, 0.3, 0.4, 0.8]));

    expect(character.relationships.length).toBeGreaterThanOrEqual(1);
    expect(character.relationships.length).toBeLessThanOrEqual(2);
    const ids = new Set(existing.map((item) => item.id));
    for (const relationship of character.relationships) {
      expect(ids.has(relationship.targetId)).toBe(true);
      expect(relationship.type).toBeTruthy();
      expect(relationship.note).toBeTruthy();
    }
    expect(MALE_NAMES).toContain(character.name);
  });
});
