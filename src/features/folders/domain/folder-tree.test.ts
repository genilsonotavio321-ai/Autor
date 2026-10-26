import { describe, expect, it } from "vitest";

import type { EntityId, Folder } from "@/shared/types/database";

import {
  collectSubtreeIds,
  directCounts,
  effectiveParentId,
  itemsInFolder,
  rootItems,
} from "./folder-tree";

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "f-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    projectId: "p-1",
    kind: "character",
    name: "Pasta",
    ...overrides,
  };
}

describe("collectSubtreeIds", () => {
  it("inclui a pasta raiz e todas as descendentes", () => {
    const folders = [
      folder({ id: "a" }),
      folder({ id: "b", parentId: "a" }),
      folder({ id: "c", parentId: "b" }),
      folder({ id: "d" }),
    ];
    expect(collectSubtreeIds(folders, "a")).toEqual(["a", "b", "c"]);
    expect(collectSubtreeIds(folders, "d")).toEqual(["d"]);
  });
});

describe("effectiveParentId", () => {
  it("órfã (mãe apagada) sobe para a raiz", () => {
    const live = new Set<EntityId>(["a"]);
    expect(effectiveParentId(folder({ parentId: "a" }), live)).toBe("a");
    expect(effectiveParentId(folder({ parentId: "ghost" }), live)).toBeNull();
    expect(effectiveParentId(folder({}), live)).toBeNull();
  });
});

describe("rootItems / itemsInFolder", () => {
  const items = [
    { id: "1" },
    { id: "2", folderId: "a" },
    { id: "3", folderId: "ghost" },
  ];
  const live = new Set<EntityId>(["a"]);

  it("raiz mostra fichas sem pasta e fichas de pasta morta", () => {
    expect(rootItems(items, live).map((item) => item.id)).toEqual(["1", "3"]);
  });

  it("dentro da pasta, só os membros diretos", () => {
    expect(itemsInFolder(items, "a").map((item) => item.id)).toEqual(["2"]);
  });
});

describe("directCounts", () => {
  it("conta fichas + pastas filhas diretas", () => {
    const folders = [
      folder({ id: "a" }),
      folder({ id: "b", parentId: "a" }),
      folder({ id: "c", parentId: "a" }),
    ];
    const items = [
      { folderId: "a" },
      { folderId: "b" },
      { folderId: "ghost" },
      {},
    ];
    const counts = directCounts(folders, items);
    expect(counts.get("a")).toBe(3); // 1 ficha + 2 pastas filhas
    expect(counts.get("b")).toBe(1);
    // Pasta morta entra no mapa, mas o badge só lê ids vivos (get ?? 0).
    expect(counts.get("ghost")).toBe(1);
  });
});
