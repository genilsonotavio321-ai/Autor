import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { Character, EntityId } from "@/shared/types/database";

import type {
  CharacterCreateInput,
  CharacterRepository,
  CharacterUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieCharacterRepository implements CharacterRepository {
  async create(input: CharacterCreateInput): Promise<Character> {
    await ensureDbReady();
    const now = nowIso();
    const character: Character = {
      id: createId(),
      projectId: input.projectId,
      name: input.name.trim() || "Sem nome",
      role: input.role ?? "supporting",
      description: input.description,
      backstory: input.backstory,
      goals: input.goals,
      fears: input.fears,
      traits: input.traits ?? [],
      relationships: [],
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
    return all.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async update(id: EntityId, patch: CharacterUpdateInput): Promise<Character> {
    await ensureDbReady();
    await getDatabase().characters.update(id, { ...patch, updatedAt: nowIso() });
    const updated = await getDatabase().characters.get(id);
    if (!updated) throw new Error(`Character not found: ${id}`);
    return updated;
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().characters.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .characters.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().characters.delete(id);
  }

  async listDeleted(): Promise<Character[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .characters.filter((character) => Boolean(character.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const characterRepository: CharacterRepository =
  new DexieCharacterRepository();
