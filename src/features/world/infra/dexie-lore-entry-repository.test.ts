import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import { DexieLoreEntryRepository } from "./dexie-lore-entry-repository";

const repository = new DexieLoreEntryRepository();
const projectId = crypto.randomUUID();

beforeEach(async () => {
  await getDatabase().loreEntries.clear();
});

describe("DexieLoreEntryRepository", () => {
  it("creates an entry with defaults", async () => {
    const entry = await repository.create({ projectId, title: "  Coroa  " });

    expect(entry.id).toBeTruthy();
    expect(entry.title).toBe("Coroa");
    expect(entry.category).toBe("Geral");
    expect(entry.content).toBe("");
    expect(entry.linkedIds).toEqual([]);
    expect(entry.tags).toEqual([]);
  });

  it("lists entries in manual order", async () => {
    const zodiaco = await repository.create({ projectId, title: "Zodíaco", category: "Mitologia" });
    await repository.create({ projectId, title: "Aurora", category: "História" });
    await repository.create({ projectId, title: "A Coroa", category: "História" });

    const list = await repository.listByProject(projectId);

    expect(list.map((entry) => entry.title)).toEqual([
      "Zodíaco",
      "Aurora",
      "A Coroa",
    ]);

    await repository.applyMoves([{ id: zodiaco.id, order: 10 }]);
    expect(
      (await repository.listByProject(projectId)).map((entry) => entry.title),
    ).toEqual(["Aurora", "A Coroa", "Zodíaco"]);
  });

  it("updates content and linkedIds, then soft deletes and restores", async () => {
    const entry = await repository.create({ projectId, title: "Coroa" });
    const linked = crypto.randomUUID();

    const updated = await repository.update(entry.id, {
      content: "Forjada na Primeira Era.",
      linkedIds: [linked],
    });
    expect(updated.content).toBe("Forjada na Primeira Era.");
    expect(updated.linkedIds).toEqual([linked]);

    await repository.softDelete(entry.id);
    expect(await repository.listByProject(projectId)).toEqual([]);
    expect(await repository.listDeleted()).toHaveLength(1);

    await repository.restore(entry.id);
    expect(await repository.listDeleted()).toEqual([]);
    expect((await repository.getById(entry.id))?.deletedAt).toBeUndefined();
  });

  it("throws when updating a missing entry", async () => {
    await expect(
      repository.update(crypto.randomUUID(), { title: "Nada" }),
    ).rejects.toThrow("LoreEntry not found");
  });
});
