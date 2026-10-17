import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import type { EntityId, PlotBeat } from "@/shared/types/database";

import type {
  PlotBeatCreateInput,
  PlotBeatRepository,
  PlotBeatUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexiePlotBeatRepository implements PlotBeatRepository {
  async create(input: PlotBeatCreateInput): Promise<PlotBeat> {
    await ensureDbReady();
    const db = getDatabase();
    const existing = await db.plotBeats
      .filter((beat) => beat.projectId === input.projectId)
      .toArray();
    const order =
      existing.reduce((max, beat) => Math.max(max, beat.order), 0) + 1;
    const now = nowIso();
    const beat: PlotBeat = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      structure: input.structure,
      title: input.title,
      description: input.description,
      order,
      createdAt: now,
      updatedAt: now,
    };
    await db.plotBeats.add(beat);
    return beat;
  }

  async listByProject(projectId: EntityId): Promise<PlotBeat[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .plotBeats.filter(
        (beat) => beat.projectId === projectId && !beat.deletedAt,
      )
      .toArray();
    return all.sort((a, b) => a.order - b.order);
  }

  async update(id: EntityId, patch: PlotBeatUpdateInput): Promise<PlotBeat> {
    await ensureDbReady();
    // `null` in the input means "clear the link" — Dexie's Table.update
    // would store `undefined` instead of removing the key, so use modify.
    await getDatabase()
      .plotBeats.where("id")
      .equals(id)
      .modify((beat) => {
        if (patch.title !== undefined) beat.title = patch.title;
        if (patch.description !== undefined)
          beat.description = patch.description;
        if (patch.linkedChapterId !== undefined) {
          if (patch.linkedChapterId === null)
            delete beat.linkedChapterId;
          else beat.linkedChapterId = patch.linkedChapterId;
        }
        if (patch.linkedSceneId !== undefined) {
          if (patch.linkedSceneId === null) delete beat.linkedSceneId;
          else beat.linkedSceneId = patch.linkedSceneId;
        }
        beat.updatedAt = nowIso();
      });
    const updated = await getDatabase().plotBeats.get(id);
    if (!updated) throw new Error(`PlotBeat not found: ${id}`);
    return updated;
  }

  async applyMoves(
    updates: { id: EntityId; order: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.plotBeats, async () => {
      for (const move of updates) {
        await db.plotBeats.update(move.id, {
          order: move.order,
          updatedAt: nowIso(),
        });
      }
    });
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().plotBeats.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}

export const plotBeatRepository: PlotBeatRepository =
  new DexiePlotBeatRepository();
