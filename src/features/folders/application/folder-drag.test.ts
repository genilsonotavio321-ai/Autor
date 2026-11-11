import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { FOLDER_EXIT_ID, resolveHintMode } from "./folder-drag";

const centered = { left: 45, top: 45, width: 10, height: 10 };
const edge = { left: 0, top: 0, width: 10, height: 10 };
const over = { left: 0, top: 0, width: 100, height: 100 };

describe("resolveHintMode", () => {
  it("sem alvo, ou sobre o próprio card, nada a avisar", () => {
    expect(
      resolveHintMode({
        viewFolderIds: ["f1"],
        activeId: "a",
        overId: undefined,
        activeRect: centered,
        overRect: over,
      }),
    ).toBeNull();
    expect(
      resolveHintMode({
        viewFolderIds: ["f1"],
        activeId: "a",
        overId: "a",
        activeRect: centered,
        overRect: over,
      }),
    ).toBeNull();
  });

  it("seta voltar, pasta alvo e centro de card anunciam a ação", () => {
    expect(
      resolveHintMode({
        viewFolderIds: ["f1"],
        activeId: "a",
        overId: FOLDER_EXIT_ID,
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("exit");
    expect(
      resolveHintMode({
        viewFolderIds: ["f1"],
        activeId: "a",
        overId: "f1",
        activeRect: edge,
        overRect: over,
      }),
    ).toBe("add");
    expect(
      resolveHintMode({
        viewFolderIds: [],
        activeId: "a",
        overId: "b",
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("create");
  });

  it("pasta sobre pasta anuncia aninhamento", () => {
    expect(
      resolveHintMode({
        viewFolderIds: ["f0", "f1"],
        activeId: "f0",
        overId: "f1",
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("nested");
  });

  it("borda de card e pasta sobre ficha não anunciam nada", () => {
    expect(
      resolveHintMode({
        viewFolderIds: [],
        activeId: "a",
        overId: "b",
        activeRect: edge,
        overRect: over,
      }),
    ).toBeNull();
    expect(
      resolveHintMode({
        viewFolderIds: ["f0"],
        activeId: "f0",
        overId: "b",
        activeRect: centered,
        overRect: over,
      }),
    ).toBeNull();
  });
});
