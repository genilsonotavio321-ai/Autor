import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { nextOrder } from "@/shared/lib/dexie-order";
import { createId } from "@/shared/lib/id";
import type {
  EntityId,
  StructureScope,
  StructureSection,
} from "@/shared/types/database";

import type {
  StructureSectionCreateInput,
  StructureSectionRepository,
  StructureSectionUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieStructureSectionRepository
  implements StructureSectionRepository
{
  async create(
    input: StructureSectionCreateInput,
  ): Promise<StructureSection> {
    await ensureDbReady();
    const db = getDatabase();
    const existing = await db.structureSections
      .filter(
        (section) =>
          section.projectId === input.projectId &&
          section.scope === input.scope &&
          (section.arcId ?? undefined) === input.arcId,
      )
      .toArray();
    const now = nowIso();
    const section: StructureSection = {
      id: createId(),
      projectId: input.projectId,
      scope: input.scope,
      arcId: input.arcId,
      templateKey: input.templateKey,
      title: input.title.trim() || "Seção",
      description: input.description,
      order: input.order ?? nextOrder(existing),
      createdAt: now,
      updatedAt: now,
    };
    await db.structureSections.add(section);
    return section;
  }

  async listByProject(projectId: EntityId): Promise<StructureSection[]> {
    await ensureDbReady();
    const sections = await getDatabase()
      .structureSections.filter((section) => section.projectId === projectId)
      .toArray();
    return sections.sort((a, b) => a.order - b.order);
  }

  async update(
    id: EntityId,
    patch: StructureSectionUpdateInput,
  ): Promise<StructureSection> {
    await ensureDbReady();
    await getDatabase().structureSections.update(id, {
      ...patch,
      updatedAt: nowIso(),
    });
    const updated = await getDatabase().structureSections.get(id);
    if (!updated) throw new Error(`StructureSection not found: ${id}`);
    return updated;
  }

  async reorder(updates: { id: EntityId; order: number }[]): Promise<void> {
    if (updates.length === 0) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.structureSections, async () => {
      for (const move of updates) {
        await db.structureSections.update(move.id, {
          order: move.order,
          updatedAt: nowIso(),
        });
      }
    });
  }

  async remove(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().structureSections.delete(id);
  }

  async removeByScope(
    projectId: EntityId,
    scope: StructureScope,
    arcId?: EntityId,
  ): Promise<void> {
    await ensureDbReady();
    await getDatabase()
      .structureSections.filter(
        (section) =>
          section.projectId === projectId &&
          section.scope === scope &&
          (section.arcId ?? undefined) === arcId,
      )
      .delete();
  }
}

export const structureSectionRepository: StructureSectionRepository =
  new DexieStructureSectionRepository();
