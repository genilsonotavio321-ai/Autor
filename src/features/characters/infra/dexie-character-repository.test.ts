import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import { DexieCharacterRepository } from "./dexie-character-repository";

const repository = new DexieCharacterRepository();
const projectId = crypto.randomUUID();

beforeEach(async () => {
  await getDatabase().characters.clear();
});

describe("DexieCharacterRepository", () => {
  it("creates a character with defaults", async () => {
    const character = await repository.create({ projectId, name: "  Ana  " });

    expect(character.id).toBeTruthy();
    expect(character.name).toBe("Ana");
    expect(character.role).toBe("supporting");
    expect(character.traits).toEqual([]);
    expect(character.relationships).toEqual([]);
    expect(character.tags).toEqual([]);
    expect(character.deletedAt).toBeUndefined();
  });

  it("falls back to a placeholder name when empty", async () => {
    const character = await repository.create({ projectId, name: "   " });
    expect(character.name).toBe("Sem nome");
  });

  it("lists project characters in manual order and skips deleted", async () => {
    const bruno = await repository.create({ projectId, name: "Bruno" });
    await repository.create({ projectId, name: "Ana" });
    const other = await repository.create({
      projectId: crypto.randomUUID(),
      name: "Zeta",
    });
    const deleted = await repository.create({ projectId, name: "Caio" });
    await repository.softDelete(deleted.id);

    const list = await repository.listByProject(projectId);

    // Fichas novas entram no fim, não em ordem alfabética.
    expect(list.map((character) => character.name)).toEqual(["Bruno", "Ana"]);
    expect(list.some((character) => character.id === other.id)).toBe(false);

    // Reordenar move a ficha (ordem sobrevive à nova consulta).
    await repository.applyMoves([{ id: bruno.id, order: 10 }]);
    expect(
      (await repository.listByProject(projectId)).map((item) => item.name),
    ).toEqual(["Ana", "Bruno"]);
  });

  it("updates fields and bumps updatedAt", async () => {
    const character = await repository.create({ projectId, name: "Ana" });

    const updated = await repository.update(character.id, {
      role: "protagonist",
      traits: ["corajosa", "leal"],
      relationships: [
        { targetId: crypto.randomUUID(), type: "friend", note: "infância" },
      ],
    });

    expect(updated.role).toBe("protagonist");
    expect(updated.traits).toEqual(["corajosa", "leal"]);
    expect(updated.relationships).toHaveLength(1);
    expect(updated.updatedAt >= character.updatedAt).toBe(true);
  });

  it("throws when updating a missing character", async () => {
    await expect(
      repository.update(crypto.randomUUID(), { name: "Nada" }),
    ).rejects.toThrow("Character not found");
  });

  it("soft deletes and restores", async () => {
    const character = await repository.create({ projectId, name: "Ana" });

    await repository.softDelete(character.id);
    expect(await repository.listByProject(projectId)).toEqual([]);
    const deleted = await repository.listDeleted();
    expect(deleted.map((item) => item.id)).toEqual([character.id]);

    await repository.restore(character.id);
    expect(await repository.listDeleted()).toEqual([]);
    const restored = await repository.getById(character.id);
    expect(restored?.deletedAt).toBeUndefined();
    expect(await repository.listByProject(projectId)).toHaveLength(1);
  });
});
