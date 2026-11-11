import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import { applyOrderMoves, compareOrder, nextOrder } from "@/shared/lib/dexie-order";
import type { EntityId, Location } from "@/shared/types/database";

import type {
  LocationCreateInput,
  LocationRepository,
  LocationUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieLocationRepository implements LocationRepository {
  async create(input: LocationCreateInput): Promise<Location> {
    await ensureDbReady();
    const now = nowIso();
    const live = await getDatabase()
      .locations.filter(
        (location) => location.projectId === input.projectId && !location.deletedAt,
      )
      .toArray();
    const location: Location = {
      id: createId(),
      projectId: input.projectId,
      name: input.name.trim() || "Sem nome",
      order: nextOrder(live),
      type: input.type?.trim() || "Local",
      description: input.description,
      parentId: input.parentId ?? undefined,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().locations.add(location);
    return location;
  }

  async getById(id: EntityId): Promise<Location | undefined> {
    await ensureDbReady();
    return getDatabase().locations.get(id);
  }

  async listByProject(projectId: EntityId): Promise<Location[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .locations.filter(
        (location) => location.projectId === projectId && !location.deletedAt,
      )
      .toArray();
    return all.sort(
      (a, b) => compareOrder(a, b) || a.name.localeCompare(b.name, "pt-BR"),
    );
  }

  async update(id: EntityId, patch: LocationUpdateInput): Promise<Location> {
    await ensureDbReady();
    const { parentId, ...rest } = patch;
    await getDatabase().locations.update(id, { ...rest, updatedAt: nowIso() });
    if (parentId !== undefined) {
      // `modify` with undefined removes the property (Table.update would not).
      await getDatabase()
        .locations.where("id")
        .equals(id)
        .modify({ parentId: parentId === null ? undefined : parentId });
    }
    const updated = await getDatabase().locations.get(id);
    if (!updated) throw new Error(`Location not found: ${id}`);
    return updated;
  }

  async applyMoves(updates: { id: EntityId; order: number }[]): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await applyOrderMoves(db, "locations", updates);
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().locations.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .locations.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().locations.delete(id);
  }

  async listDeleted(): Promise<Location[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .locations.filter((location) => Boolean(location.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const locationRepository: LocationRepository =
  new DexieLocationRepository();
