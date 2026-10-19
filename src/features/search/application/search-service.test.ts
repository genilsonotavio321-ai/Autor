import { describe, expect, it } from "vitest";

import type {
  Chapter,
  Character,
  EntityId,
  Location,
  LoreEntry,
  Note,
  Project,
  Scene,
} from "@/shared/types/database";

import { createSearchIndex, searchDocs } from "./search-service";
import { buildSearchDocs } from "../domain/search-doc";

const now = "2026-01-01T00:00:00.000Z";

function makeProject(id: EntityId, title: string): Project {
  return {
    id,
    title,
    subtitle: "",
    author: "",
    description: "",
    status: "active",
    settings: {},
    createdAt: now,
    updatedAt: now,
  };
}

function makeChapter(id: EntityId, projectId: EntityId, title: string, text: string): Chapter {
  return {
    id,
    projectId,
    title,
    order: 1,
    status: "draft",
    wordCount: 0,
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    createdAt: now,
    updatedAt: now,
  };
}

function makeCharacter(id: EntityId, projectId: EntityId, name: string): Character {
  return {
    id,
    projectId,
    name,
    role: "protagonist",
    description: "Herói da história",
    backstory: "",
    goals: "",
    fears: "",
    traits: ["corajoso"],
    relationships: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("buildSearchDocs", () => {
  const project = makeProject("p1", "Romance");
  const chapter = makeChapter("c1", "p1", "Capítulo 1", "Era uma vez um dragão.");
  const deletedChapter = { ...makeChapter("c2", "p1", "Rascunho", "segredo"), deletedAt: now };

  it("builds docs for every entity and skips deleted ones", () => {
    const scene: Scene = {
      id: "s1",
      chapterId: "c1",
      title: "Cena da caverna",
      order: 1,
      status: "todo",
      summary: "Confronto final",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      createdAt: now,
      updatedAt: now,
    };
    const character = makeCharacter("ch1", "p1", "Ana");
    const location: Location = {
      id: "l1",
      projectId: "p1",
      name: "Castelo Norte",
      type: "Fortaleza",
      description: "Muito frio",
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    const lore: LoreEntry = {
      id: "lo1",
      projectId: "p1",
      title: "A Coroa",
      category: "História",
      content: "Coroa antiga dos reis",
      linkedIds: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    const note: Note = {
      id: "n1",
      projectId: "p1",
      title: "Ideia de final",
      content: "O herói vence no fim",
      pinned: true,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    const docs = buildSearchDocs({
      projects: [project],
      chapters: [chapter, deletedChapter],
      scenes: [scene],
      characters: [character],
      locations: [location],
      loreEntries: [lore],
      notes: [note],
    });

    expect(docs).toHaveLength(7);
    expect(docs.map((doc) => doc.type).sort()).toEqual([
      "chapter",
      "character",
      "location",
      "lore",
      "note",
      "project",
      "scene",
    ]);
    expect(docs.find((doc) => doc.type === "chapter")?.href).toBe(
      "/read?chapter=c1",
    );
    expect(docs.find((doc) => doc.type === "character")?.href).toBe(
      "/characters?character=ch1&view=1",
    );
    const projectDoc = docs.find((doc) => doc.type === "project");
    expect(projectDoc?.href).toBe("/projects/p1");
    expect(projectDoc?.projectTitle).toBe("Romance");
    const sceneDoc = docs.find((doc) => doc.type === "scene");
    expect(sceneDoc?.projectTitle).toBe("Romance");
    expect(sceneDoc?.searchText).toContain("Confronto final");
  });

  it("skips entities of deleted projects", () => {
    const deletedProject = { ...project, deletedAt: now };
    const docs = buildSearchDocs({
      projects: [deletedProject],
      chapters: [chapter],
      scenes: [],
      characters: [],
      locations: [],
      loreEntries: [],
      notes: [],
    });
    expect(docs).toHaveLength(0);
  });
});

describe("searchDocs", () => {
  const docs = buildSearchDocs({
    projects: [makeProject("p1", "Romance")],
    chapters: [
      makeChapter("c1", "p1", "Capítulo 1", "O dragão místico guardava a floresta"),
      makeChapter("c2", "p1", "Encontro", "Ela olhou para as estrelas"),
    ],
    scenes: [],
    characters: [makeCharacter("ch1", "p1", "Dragão Azul")],
    locations: [],
    loreEntries: [],
    notes: [],
  });
  const index = createSearchIndex(docs);

  it("matches with and without accents", () => {
    expect(searchDocs(index, "dragão")).toHaveLength(2);
    expect(searchDocs(index, "dragao")).toHaveLength(2);
  });

  it("ranks title matches before content-only matches", () => {
    const results = searchDocs(index, "dragão");
    expect(results[0]?.doc.id).toBe("ch1");
    expect(results[0]?.matchedTitle).toBe(true);
    expect(results[1]?.doc.id).toBe("c1");
    expect(results[1]?.matchedTitle).toBe(false);
  });

  it("returns empty for blank queries and null indexes", () => {
    expect(searchDocs(index, "   ")).toEqual([]);
    expect(searchDocs(null, "dragão")).toEqual([]);
  });

  it("honors the limit", () => {
    expect(searchDocs(index, "dragão", 1)).toHaveLength(1);
  });

  it("finds projects regardless of case and accents", () => {
    const projectDocs = buildSearchDocs({
      projects: [makeProject("p1", "Coração de Fogo")],
      chapters: [],
      scenes: [],
      characters: [],
      locations: [],
      loreEntries: [],
      notes: [],
    });
    const projectIndex = createSearchIndex(projectDocs);

    expect(searchDocs(projectIndex, "CORAÇÃO")).toHaveLength(1);
    expect(searchDocs(projectIndex, "coracao de fogo")).toHaveLength(1);
    expect(searchDocs(projectIndex, "fogo")[0]?.doc.type).toBe("project");
  });

  it("matches partial words, including app section docs", () => {
    const sectionIndex = createSearchIndex([
      ...docs,
      {
        id: "section:/settings#editor",
        type: "section",
        title: "Editor",
        excerpt: "Opção de configurações: Editor fonte tamanho texto",
        projectId: "",
        projectTitle: "",
        href: "/settings#editor",
        searchText: "configurações editor fonte tamanho texto",
      },
    ]);

    expect(
      searchDocs(sectionIndex, "configu").some(
        (result) => result.doc.id === "section:/settings#editor",
      ),
    ).toBe(true);
    expect(
      searchDocs(sectionIndex, "edit").some(
        (result) => result.doc.id === "section:/settings#editor",
      ),
    ).toBe(true);
  });
});
