import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import { applyOrderMoves, compareOrder, nextOrder } from "@/shared/lib/dexie-order";
import type { EntityId, LoreEntry } from "@/shared/types/database";

import { DEFAULT_LORE_CATEGORY } from "../domain/repository";
import type {
  LoreEntryCreateInput,
  LoreEntryRepository,
  LoreEntryUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieLoreEntryRepository implements LoreEntryRepository {
  async create(input: LoreEntryCreateInput): Promise<LoreEntry> {
    await ensureDbReady();
    const now = nowIso();
    const live = await getDatabase()
      .loreEntries.filter(
        (entry) => entry.projectId === input.projectId && !entry.deletedAt,
      )
      .toArray();
    const entry: LoreEntry = {
      id: createId(),
      projectId: input.projectId,
      title: input.title.trim() || "Sem título",
      order: nextOrder(live),
      category: input.category?.trim() || DEFAULT_LORE_CATEGORY,
      content: input.content ?? "",
      tags: [],
      linkedIds: input.linkedIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().loreEntries.add(entry);
    return entry;
  }

  async getById(id: EntityId): Promise<LoreEntry | undefined> {
    await ensureDbReady();
    return getDatabase().loreEntries.get(id);
  }

  async listByProject(projectId: EntityId): Promise<LoreEntry[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .loreEntries.filter(
        (entry) => entry.projectId === projectId && !entry.deletedAt,
      )
      .toArray();
    return all.sort((a, b) => {
      const byOrder = compareOrder(a, b);
      if (byOrder !== 0) return byOrder;
      const byCategory = a.category.localeCompare(b.category, "pt-BR");
      if (byCategory !== 0) return byCategory;
      return a.title.localeCompare(b.title, "pt-BR");
    });
  }

  async update(id: EntityId, patch: LoreEntryUpdateInput): Promise<LoreEntry> {
    await ensureDbReady();
    await getDatabase().loreEntries.update(id, {
      ...patch,
      updatedAt: nowIso(),
    });
    const updated = await getDatabase().loreEntries.get(id);
    if (!updated) throw new Error(`LoreEntry not found: ${id}`);
    return updated;
  }

  async applyMoves(updates: { id: EntityId; order: number }[]): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await applyOrderMoves(db, "loreEntries", updates);
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().loreEntries.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .loreEntries.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().loreEntries.delete(id);
  }

  async listDeleted(): Promise<LoreEntry[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .loreEntries.filter((entry) => Boolean(entry.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const loreEntryRepository: LoreEntryRepository =
  new DexieLoreEntryRepository();
