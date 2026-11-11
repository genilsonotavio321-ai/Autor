import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, IdeaGroup } from "@/shared/types/database";

import type {
  IdeaGroupCreateInput,
  IdeaGroupRepository,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieIdeaGroupRepository implements IdeaGroupRepository {
  async create(input: IdeaGroupCreateInput): Promise<IdeaGroup> {
    await ensureDbReady();
    const name = input.name.trim();
    if (!name) throw new Error("Grupo precisa de um nome");
    const now = nowIso();
    const group: IdeaGroup = {
      id: createId(),
      projectId: input.projectId,
      name,
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().ideaGroups.add(group);
    return group;
  }

  async listByProject(projectId: EntityId): Promise<IdeaGroup[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .ideaGroups.filter((group) => group.projectId === projectId)
      .toArray();
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async rename(id: EntityId, name: string): Promise<IdeaGroup> {
    await ensureDbReady();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Grupo precisa de um nome");
    const db = getDatabase();
    const group = await db.ideaGroups.get(id);
    if (!group) throw new Error(`IdeaGroup not found: ${id}`);
    const updated = { ...group, name: trimmed, updatedAt: nowIso() };
    await db.ideaGroups.put(updated);
    return updated;
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().ideaGroups.delete(id);
  }
}

export const ideaGroupRepository: IdeaGroupRepository =
  new DexieIdeaGroupRepository();
