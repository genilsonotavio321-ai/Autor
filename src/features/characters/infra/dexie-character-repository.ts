import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import { listDeletedRows, nowIso, restoreRow, softDeleteRow } from "@/shared/lib/dexie-trash";
import { applyOrderMoves, compareOrder, nextOrder } from "@/shared/lib/dexie-order";
import type { Character, EntityId } from "@/shared/types/database";

import type {
  CharacterCreateInput,
  CharacterRepository,
  CharacterUpdateInput,
} from "../domain/repository";

export class DexieCharacterRepository implements CharacterRepository {
  async create(input: CharacterCreateInput): Promise<Character> {
    await ensureDbReady();
    const now = nowIso();
    const live = await getDatabase()
      .characters.filter(
        (character) => character.projectId === input.projectId && !character.deletedAt,
      )
      .toArray();
    const character: Character = {
      id: createId(),
      projectId: input.projectId,
      name: input.name.trim() || "Sem nome",
      order: nextOrder(live),
      role: input.role ?? "supporting",
      gender: input.gender,
      description: input.description,
      backstory: input.backstory,
      goals: input.goals,
      fears: input.fears,
      traits: input.traits ?? [],
      relationships: input.relationships ?? [],
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().characters.add(character);
    return character;
  }

  async getById(id: EntityId): Promise<Character | undefined> {
    await ensureDbReady();
    return getDatabase().characters.get(id);
  }

  async listByProject(projectId: EntityId): Promise<Character[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .characters.filter(
        (character) => character.projectId === projectId && !character.deletedAt,
      )
      .toArray();
    return all.sort(
      (a, b) => compareOrder(a, b) || a.name.localeCompare(b.name, "pt-BR"),
    );
  }

  async update(id: EntityId, patch: CharacterUpdateInput): Promise<Character> {
    await ensureDbReady();
    await getDatabase().characters.update(id, { ...patch, updatedAt: nowIso() });
    const updated = await getDatabase().characters.get(id);
    if (!updated) throw new Error(`Character not found: ${id}`);
    return updated;
  }

  async applyMoves(updates: { id: EntityId; order: number }[]): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await applyOrderMoves(db, "characters", updates);
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await softDeleteRow(getDatabase().characters, id);
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    await restoreRow(getDatabase().characters, id);
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().characters.delete(id);
  }

  async listDeleted(): Promise<Character[]> {
    await ensureDbReady();
    return listDeletedRows(getDatabase().characters);
  }
}

export const characterRepository: CharacterRepository =
  new DexieCharacterRepository();
