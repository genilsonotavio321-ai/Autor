import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import { nextOrder } from "@/shared/lib/dexie-order";
import type { EntityId, NarrativeArc } from "@/shared/types/database";

import type {
  NarrativeArcCreateInput,
  NarrativeArcRepository,
  NarrativeArcUpdateInput,
} from "../domain/narrative-arc-repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieNarrativeArcRepository implements NarrativeArcRepository {
  async create(input: NarrativeArcCreateInput): Promise<NarrativeArc> {
    await ensureDbReady();
    const db = getDatabase();
    const existing = await db.storyArcs
      .filter((arc) => arc.projectId === input.projectId && !arc.deletedAt)
      .toArray();
    const now = nowIso();
    const arc: NarrativeArc = {
      id: createId(),
      projectId: input.projectId,
      name: input.name.trim() || "Arco sem título",
      description: input.description?.trim() || undefined,
      color: input.color,
      order: nextOrder(existing),
      createdAt: now,
      updatedAt: now,
    };
    await db.storyArcs.add(arc);
    return arc;
  }

  async getById(id: EntityId): Promise<NarrativeArc | undefined> {
    await ensureDbReady();
    return getDatabase().storyArcs.get(id);
  }

  async listByProject(projectId: EntityId): Promise<NarrativeArc[]> {
    await ensureDbReady();
    const arcs = await getDatabase()
      .storyArcs.filter((arc) => arc.projectId === projectId && !arc.deletedAt)
      .toArray();
    return arcs.sort((a, b) => a.order - b.order);
  }

  async update(
    id: EntityId,
    patch: NarrativeArcUpdateInput,
  ): Promise<NarrativeArc> {
    await ensureDbReady();
    await getDatabase()
      .storyArcs.where("id")
      .equals(id)
      .modify((arc) => {
        if (patch.name !== undefined) arc.name = patch.name.trim();
        if (patch.description !== undefined) {
          if (patch.description === null || !patch.description.trim()) {
            delete arc.description;
          } else {
            arc.description = patch.description.trim();
          }
        }
        if (patch.color !== undefined) {
          if (patch.color === null || !patch.color.trim()) delete arc.color;
          else arc.color = patch.color;
        }
        arc.updatedAt = nowIso();
      });
    const updated = await getDatabase().storyArcs.get(id);
    if (!updated) throw new Error(`NarrativeArc not found: ${id}`);
    return updated;
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().storyArcs.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase()
      .storyArcs.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.storyArcs, db.timelineEvents, async () => {
      await db.timelineEvents
        .filter((event) => event.arcIds?.includes(id) ?? false)
        .modify((event) => {
          event.arcIds = (event.arcIds ?? []).filter((arcId) => arcId !== id);
        });
      await db.storyArcs.delete(id);
    });
  }

  async listDeleted(): Promise<NarrativeArc[]> {
    await ensureDbReady();
    const arcs = await getDatabase()
      .storyArcs.filter((arc) => Boolean(arc.deletedAt))
      .toArray();
    return arcs.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const narrativeArcRepository: NarrativeArcRepository =
  new DexieNarrativeArcRepository();
