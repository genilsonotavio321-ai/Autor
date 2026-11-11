import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, PlotBeat, StructureScope } from "@/shared/types/database";

import type {
  PlotBeatCreateInput,
  PlotBeatRepository,
  PlotBeatUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

function sameScope(
  beat: PlotBeat,
  scope: StructureScope,
  arcId: EntityId | undefined,
): boolean {
  return beat.scope === scope && (beat.arcId ?? undefined) === arcId;
}

export class DexiePlotBeatRepository implements PlotBeatRepository {
  async create(input: PlotBeatCreateInput): Promise<PlotBeat> {
    await ensureDbReady();
    const db = getDatabase();
    // Ignora beats na lixeira (mesmo critério dos capítulos — A0).
    const existing = await db.plotBeats
      .filter(
        (beat) =>
          beat.projectId === input.projectId &&
          !beat.deletedAt &&
          sameScope(beat, input.scope, input.arcId),
      )
      .toArray();
    const order =
      existing.reduce((max, beat) => Math.max(max, beat.order), 0) + 1;
    const now = nowIso();
    const beat: PlotBeat = {
      id: createId(),
      projectId: input.projectId,
      scope: input.scope,
      arcId: input.arcId,
      sectionId: input.sectionId,
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
    // would store `null`/`undefined` instead of removing the key.
    await getDatabase()
      .plotBeats.where("id")
      .equals(id)
      .modify((beat) => {
        if (patch.title !== undefined) beat.title = patch.title;
        if (patch.description !== undefined)
          beat.description = patch.description;
        if (patch.sectionId !== undefined) {
          if (patch.sectionId === null) delete beat.sectionId;
          else beat.sectionId = patch.sectionId;
        }
        if (patch.linkedChapterId !== undefined) {
          if (patch.linkedChapterId === null) delete beat.linkedChapterId;
          else beat.linkedChapterId = patch.linkedChapterId;
        }
        if (patch.poltiSituation !== undefined) {
          if (!patch.poltiSituation) delete beat.poltiSituation;
          else beat.poltiSituation = patch.poltiSituation;
        }
        if (patch.souriauFunctions !== undefined) {
          const assigned = Object.fromEntries(
            Object.entries(patch.souriauFunctions ?? {}).filter(
              ([, value]) => Boolean(value),
            ),
          );
          if (Object.keys(assigned).length === 0)
            delete beat.souriauFunctions;
          else beat.souriauFunctions = assigned;
        }
        beat.updatedAt = nowIso();
      });
    const updated = await getDatabase().plotBeats.get(id);
    if (!updated) throw new Error(`PlotBeat not found: ${id}`);
    return updated;
  }

  async applyMoves(
    updates: { id: EntityId; sectionId?: EntityId; order: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.plotBeats, async () => {
      for (const move of updates) {
        const patch: Partial<PlotBeat> = {
          order: move.order,
          updatedAt: nowIso(),
        };
        if (move.sectionId !== undefined) patch.sectionId = move.sectionId;
        await db.plotBeats.update(move.id, patch);
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

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .plotBeats.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().plotBeats.delete(id);
  }

  async listDeleted(): Promise<PlotBeat[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .plotBeats.filter((beat) => Boolean(beat.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const plotBeatRepository: PlotBeatRepository =
  new DexiePlotBeatRepository();
