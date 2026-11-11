import { describe, expect, it } from "vitest";

import type {
  Chapter,
  Character,
  Json,
  Location,
  LoreEntry,
  NarrativeArc,
  Project,
  Scene,
  StoryItem,
  TimelineEvent,
} from "@/shared/types/database";

import { buildAiContext, estimateContextTokens } from "./ai-context";

const now = "2026-01-01T00:00:00.000Z";
const doc: Json = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "A porta se abriu." }] }],
};

const project: Project = {
  id: "p1",
  title: "Romance",
  description: "Uma jornada por um reino antigo.",
  status: "active",
  settings: {},
  createdAt: now,
  updatedAt: now,
};

const chapter: Chapter = {
  id: "ch1",
  projectId: "p1",
  title: "A chegada",
  order: 1,
  status: "draft",
  wordCount: 4,
  content: doc,
  createdAt: now,
  updatedAt: now,
};

const scene: Scene = {
  id: "s1",
  chapterId: "ch1",
  title: "O castelo",
  order: 1,
  summary: "Ana chega ferida ao castelo.",
  content: doc,
  status: "draft",
  createdAt: now,
  updatedAt: now,
};

const character: Character = {
  id: "ana",
  projectId: "p1",
  name: "Ana",
  role: "protagonist",
  goals: "Encontrar a irmã",
  traits: ["Corajosa"],
  relationships: [],
  tags: [],
  createdAt: now,
  updatedAt: now,
};

const location: Location = {
  id: "castle",
  projectId: "p1",
  name: "Castelo",
  type: "Fortaleza",
  tags: [],
  createdAt: now,
  updatedAt: now,
};

const item: StoryItem = { id: "sword", name: "Espada" };
const arc: NarrativeArc = {
  id: "arc1",
  projectId: "p1",
  name: "Jornada de Ana",
  order: 0,
  createdAt: now,
  updatedAt: now,
};

const lore: LoreEntry = {
  id: "lore1",
  projectId: "p1",
  title: "A antiga guerra",
  category: "História",
  content: "O reino foi dividido após a guerra.",
  tags: [],
  linkedIds: ["ana", "castle"],
  createdAt: now,
  updatedAt: now,
};

const event: TimelineEvent = {
  id: "event1",
  projectId: "p1",
  date: "1889-05-12",
  title: "Chegada ao castelo",
  characterIds: ["ana"],
  locationId: "castle",
  linkedChapterId: "ch1",
  arcIds: ["arc1"],
  stateChanges: [
    {
      kind: "character",
      characterId: "ana",
      motivation: "Encontrar a irmã",
      physicalCondition: "Ferida",
    },
    { kind: "item", action: "acquire", itemId: "sword", characterId: "ana" },
  ],
  tags: [],
  createdAt: now,
  updatedAt: now,
};

describe("buildAiContext", () => {
  it("exports project bible and selected chapter state within the token budget", () => {
    const result = buildAiContext({
      project,
      chapter,
      scenes: [scene],
      characters: [character],
      locations: [location],
      loreEntries: [lore],
      arcs: [arc],
      items: [item],
      events: [event],
      budgetTokens: 2_000,
    });

    expect(result.exceedsBudget).toBe(false);
    expect(result.markdown).toContain("# Contexto · Romance");
    expect(result.markdown).toContain("## Capítulo atual · A chegada");
    expect(result.markdown).toContain("Motivação ativa: Encontrar a irmã");
    expect(result.markdown).toContain("Estado físico: Ferida");
    expect(result.markdown).toContain("Inventário: Espada");
    expect(result.markdown).toContain("Jornada de Ana");
    expect(result.estimatedTokens).toBe(estimateContextTokens(result.markdown));
    expect(result.estimatedTokens).toBeLessThanOrEqual(2_000);
  });

  it("omits lower-priority bible records instead of exceeding budget", () => {
    const manyLoreEntries = Array.from({ length: 30 }, (_, index) => ({
      ...lore,
      id: `lore-${index}`,
      title: `Lore ${index}`,
      content: "Detalhe do mundo. ".repeat(80),
      linkedIds: [],
    }));
    const result = buildAiContext({
      project,
      chapter,
      scenes: [scene],
      characters: [character],
      locations: [location],
      loreEntries: manyLoreEntries,
      arcs: [arc],
      items: [item],
      events: [event],
      budgetTokens: 500,
    });

    expect(result.exceedsBudget).toBe(false);
    expect(result.omittedRecords).toBeGreaterThan(0);
    expect(result.markdown).toContain("Registros omitidos pelo limite");
    expect(result.estimatedTokens).toBeLessThanOrEqual(500);
  });

  it("refuses a budget too small for required chapter context", () => {
    const result = buildAiContext({
      project,
      chapter,
      scenes: [scene],
      characters: [character],
      locations: [location],
      loreEntries: [lore],
      arcs: [arc],
      items: [item],
      events: [event],
      budgetTokens: 10,
    });

    expect(result.exceedsBudget).toBe(true);
    expect(result.markdown).toBe("");
  });
});
