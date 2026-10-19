import { describe, expect, it } from "vitest";

import type { EntityId, Location } from "@/shared/types/database";

import {
  MAX_LOCATION_DEPTH,
  locationDepth,
  locationParentCandidates,
} from "./repository";

function makeLocation(
  id: EntityId,
  parentId: EntityId | null = null,
): Location {
  return {
    id,
    projectId: "p1",
    name: id,
    type: "Cidade",
    parentId,
    order: 0,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: undefined,
  } as Location;
}

describe("MAX_LOCATION_DEPTH", () => {
  it("limita a hierarquia a 3 níveis (raiz → filho → neto)", () => {
    expect(MAX_LOCATION_DEPTH).toBe(3);
  });
});

describe("locationDepth", () => {
  it("conta raiz como nível 1", () => {
    const root = makeLocation("a");
    const byId = new Map([[root.id, root]]);
    expect(locationDepth(root, byId)).toBe(1);
  });

  it("filho = 2 e neto = 3", () => {
    const root = makeLocation("a");
    const child = makeLocation("b", "a");
    const grandchild = makeLocation("c", "b");
    const byId = new Map(
      [root, child, grandchild].map((item) => [item.id, item]),
    );
    expect(locationDepth(child, byId)).toBe(2);
    expect(locationDepth(grandchild, byId)).toBe(3);
  });

  it("ignora pai ausente no mapa", () => {
    const orphan = makeLocation("b", "missing");
    expect(locationDepth(orphan, new Map())).toBe(1);
  });

  it("é segura contra ciclos (para ao repetir ancestral)", () => {
    const a = makeLocation("a", "b");
    const b = makeLocation("b", "a");
    const byId = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    expect(locationDepth(a, byId)).toBe(2);
    expect(locationDepth(b, byId)).toBe(2);
  });

  it("é segura contra autorreferência", () => {
    const self = makeLocation("a", "a");
    expect(locationDepth(self, new Map([["a", self]]))).toBe(1);
  });
});

describe("locationParentCandidates", () => {
  const root = makeLocation("root");
  const child = makeLocation("child", "root");
  const grandchild = makeLocation("grandchild", "child");
  const deep = makeLocation("deep", "grandchild");
  const locations = [root, child, grandchild, deep];

  it("sem ficha atual: exclui candidatos que ultrapassariam 3 níveis", () => {
    const candidates = locationParentCandidates(null, locations);
    const ids = candidates.map((item) => item.id);
    // root (1) e child (2) podem receber filhos; grandchild (3) e deep (4) não.
    expect(ids).toEqual(["root", "child"]);
  });

  it("exclui a própria ficha e seus descendentes (evita ciclos)", () => {
    const candidates = locationParentCandidates(child, locations);
    const ids = candidates.map((item) => item.id);
    expect(ids).not.toContain("child");
    expect(ids).not.toContain("grandchild");
    expect(ids).not.toContain("deep");
    expect(ids).toContain("root");
  });

  it("mantém a ficha-mãe atual mesmo em dados acima do limite", () => {
    // Editando "deep" (nível 4): o pai "grandchild" (nível 3) é filtrado
    // por profundidade, mas deve continuar listado para não perder o vínculo.
    const candidates = locationParentCandidates(deep, locations);
    const ids = candidates.map((item) => item.id);
    expect(ids).toContain("grandchild");
    expect(ids).toContain("root");
    expect(ids).toContain("child");
    expect(ids).not.toContain("deep");
  });
});
