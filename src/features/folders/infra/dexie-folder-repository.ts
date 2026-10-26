import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import {
  applyOrderMoves,
  compareOrder,
  nextOrder,
} from "@/shared/lib/dexie-order";
import type { EntityId, Folder, FolderKind } from "@/shared/types/database";

import type {
  FolderCreateInput,
  FolderRepository,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

const KIND_TABLES: Record<FolderKind, string> = {
  character: "characters",
  location: "locations",
  lore: "loreEntries",
  note: "notes",
};

export class DexieFolderRepository implements FolderRepository {
  async create(input: FolderCreateInput): Promise<Folder> {
    await ensureDbReady();
    const now = nowIso();
    const live = await getDatabase()
      .folders.filter(
        (folder) => folder.projectId === input.projectId && !folder.deletedAt,
      )
      .toArray();
    const folder: Folder = {
      id: createId(),
      projectId: input.projectId,
      kind: input.kind,
      name: input.name?.trim() || "Nova pasta",
      order: nextOrder(live.filter((item) => item.kind === input.kind)),
      ...(input.parentId ? { parentId: input.parentId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().folders.add(folder);
    return folder;
  }

  async getById(id: EntityId): Promise<Folder | undefined> {
    await ensureDbReady();
    return getDatabase().folders.get(id);
  }

  async rename(id: EntityId, name: string): Promise<Folder> {
    await ensureDbReady();
    await getDatabase().folders.update(id, {
      name: name.trim() || "Nova pasta",
      updatedAt: nowIso(),
    });
    const updated = await getDatabase().folders.get(id);
    if (!updated) throw new Error(`Folder not found: ${id}`);
    return updated;
  }

  async listByProject(projectId: EntityId): Promise<Folder[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .folders.filter(
        (folder) => folder.projectId === projectId && !folder.deletedAt,
      )
      .toArray();
    return all.sort(
      (a, b) => compareOrder(a, b) || a.name.localeCompare(b.name, "pt-BR"),
    );
  }

  async applyMoves(updates: { id: EntityId; order: number }[]): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await applyOrderMoves(db, "folders", updates);
  }

  async setParent(
    id: EntityId,
    parentId: EntityId | undefined,
  ): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .folders.where("id")
      .equals(id)
      .modify({ parentId, updatedAt: nowIso() });
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().folders.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase()
      .folders.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().folders.delete(id);
  }

  async listDeleted(): Promise<Folder[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .folders.filter((folder) => Boolean(folder.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const folderRepository: FolderRepository = new DexieFolderRepository();

/**
 * Grava (ou limpa, com `undefined`) a pasta de uma ficha. `modify` com
 * undefined remove o campo — `Table.update` não remove.
 */
export async function setEntityFolderId(
  kind: FolderKind,
  id: EntityId,
  folderId: EntityId | undefined,
): Promise<void> {
  await ensureDbReady();
  await getDatabase()
    .table(KIND_TABLES[kind])
    .where("id")
    .equals(id)
    .modify({ folderId, updatedAt: nowIso() });
}
