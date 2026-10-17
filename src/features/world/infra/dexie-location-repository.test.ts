import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import { DexieLocationRepository } from "./dexie-location-repository";

const repository = new DexieLocationRepository();
const projectId = crypto.randomUUID();

beforeEach(async () => {
  await getDatabase().locations.clear();
});

describe("DexieLocationRepository", () => {
  it("creates a location with defaults", async () => {
    const location = await repository.create({ projectId, name: "  Norte  " });

    expect(location.id).toBeTruthy();
    expect(location.name).toBe("Norte");
    expect(location.type).toBe("Local");
    expect(location.tags).toEqual([]);
    expect(location.deletedAt).toBeUndefined();
  });

  it("lists project locations sorted by name, skipping deleted", async () => {
    await repository.create({ projectId, name: "Zara" });
    await repository.create({ projectId, name: "Aurora" });
    await repository.create({
      projectId: crypto.randomUUID(),
      name: "Outra",
    });
    const deleted = await repository.create({ projectId, name: "Duna" });
    await repository.softDelete(deleted.id);

    const list = await repository.listByProject(projectId);

    expect(list.map((location) => location.name)).toEqual(["Aurora", "Zara"]);
  });

  it("updates, soft deletes and restores", async () => {
    const location = await repository.create({ projectId, name: "Norte" });

    const updated = await repository.update(location.id, {
      type: "Castelo",
      description: "Fortaleza gelada",
    });
    expect(updated.type).toBe("Castelo");
    expect(updated.description).toBe("Fortaleza gelada");

    await repository.softDelete(location.id);
    expect(await repository.listByProject(projectId)).toEqual([]);
    expect(await repository.listDeleted()).toHaveLength(1);

    await repository.restore(location.id);
    expect(await repository.listDeleted()).toEqual([]);
    const restored = await repository.getById(location.id);
    expect(restored?.deletedAt).toBeUndefined();
  });

  it("throws when updating a missing location", async () => {
    await expect(
      repository.update(crypto.randomUUID(), { name: "Nada" }),
    ).rejects.toThrow("Location not found");
  });
});
