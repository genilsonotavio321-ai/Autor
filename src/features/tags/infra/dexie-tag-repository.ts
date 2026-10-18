import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, Tag } from "@/shared/types/database";

import {
  DEFAULT_TAG_COLOR,
  type TagCreateInput,
  type TagRepository,
  type TagUpdateInput,
} from "../domain/repository";

/** Forma mínima das tabelas que guardam referências a tags. */
interface TaggedTable {
  toArray(): Promise<Array<{ id: EntityId; tags?: EntityId[] }>>;
  update(id: EntityId, changes: { tags?: EntityId[] }): Promise<unknown>;
}

export class DexieTagRepository implements TagRepository {
  async create(input: TagCreateInput): Promise<Tag> {
    await ensureDbReady();
    const tag: Tag = {
      id: createId(),
      projectId: input.projectId,
      name: input.name.trim() || "Sem nome",
      color: input.color?.trim() || DEFAULT_TAG_COLOR,
    };
    await getDatabase().tags.add(tag);
    return tag;
  }

  async getById(id: EntityId): Promise<Tag | undefined> {
    await ensureDbReady();
    return getDatabase().tags.get(id);
  }

  async listByProject(projectId: EntityId): Promise<Tag[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .tags.filter((tag) => tag.projectId === projectId)
      .toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async update(id: EntityId, patch: TagUpdateInput): Promise<Tag> {
    await ensureDbReady();
    const changes: TagUpdateInput = {};
    if (patch.name !== undefined) changes.name = patch.name.trim() || "Sem nome";
    if (patch.color !== undefined) {
      changes.color = patch.color.trim() || DEFAULT_TAG_COLOR;
    }
    await getDatabase().tags.update(id, changes);
    const updated = await getDatabase().tags.get(id);
    if (!updated) throw new Error(`Tag not found: ${id}`);
    return updated;
  }

  async merge(sourceId: EntityId, targetId: EntityId): Promise<void> {
    await ensureDbReady();
    if (sourceId === targetId) return;
    const db = getDatabase();
    await db.transaction(
      "rw",
      [
        db.characters,
        db.locations,
        db.loreEntries,
        db.notes,
        db.timelineEvents,
        db.tags,
      ],
      async () => {
        await rewriteReferences(sourceId, targetId);
        await db.tags.delete(sourceId);
      },
    );
  }

  async remove(id: EntityId): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction(
      "rw",
      [
        db.characters,
        db.locations,
        db.loreEntries,
        db.notes,
        db.timelineEvents,
        db.tags,
      ],
      async () => {
        await rewriteReferences(id, null);
        await db.tags.delete(id);
      },
    );
  }

  async deleteByProject(projectId: EntityId): Promise<void> {
    await ensureDbReady();
    // Cascata de purga do projeto: os donos já foram apagados, então basta
    // remover as tags — sem reescrever referências.
    await getDatabase().tags.where("projectId").equals(projectId).delete();
  }
}

/** Reaponta `fromId` para `toId` (ou remove quando `toId` é null) nas entidades marcadas. */
async function rewriteReferences(
  fromId: EntityId,
  toId: EntityId | null,
): Promise<void> {
  const db = getDatabase();
  const tables = [
    db.characters,
    db.locations,
    db.loreEntries,
    db.notes,
    db.timelineEvents,
  ] as unknown as TaggedTable[];

  for (const table of tables) {
    const rows = await table.toArray();
    for (const row of rows) {
      const tags = row.tags ?? [];
      if (!tags.includes(fromId)) continue;
      const next = toId
        ? Array.from(new Set(tags.map((tag) => (tag === fromId ? toId : tag))))
        : tags.filter((tag) => tag !== fromId);
      await table.update(row.id, { tags: next });
    }
  }
}

export const tagRepository: TagRepository = new DexieTagRepository();
