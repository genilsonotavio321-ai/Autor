import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, TimelineEvent } from "@/shared/types/database";

import type {
  TimelineEventCreateInput,
  TimelineEventRepository,
  TimelineEventUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieTimelineEventRepository implements TimelineEventRepository {
  async create(input: TimelineEventCreateInput): Promise<TimelineEvent> {
    await ensureDbReady();
    const now = nowIso();
    const event: TimelineEvent = {
      id: createId(),
      projectId: input.projectId,
      date: input.date.trim(),
      time: input.time?.trim() || undefined,
      title: input.title.trim(),
      description: input.description,
      characterIds: [...new Set(input.characterIds ?? [])],
      locationId: input.locationId,
      linkedChapterId: input.linkedChapterId,
      linkedSceneId: input.linkedSceneId,
      arcIds: [...new Set(input.arcIds ?? [])],
      stateChanges: input.stateChanges ?? [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().timelineEvents.add(event);
    return event;
  }

  async listByProject(projectId: EntityId): Promise<TimelineEvent[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .timelineEvents.filter(
        (event) => event.projectId === projectId && !event.deletedAt,
      )
      .toArray();
    // Lexicographic sort — "date" is YYYY / YYYY-MM / YYYY-MM-DD (plan §5).
    return all.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time ?? "").localeCompare(b.time ?? "") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }

  async update(
    id: EntityId,
    patch: TimelineEventUpdateInput,
  ): Promise<TimelineEvent> {
    await ensureDbReady();
    await getDatabase()
      .timelineEvents.where("id")
      .equals(id)
      .modify((event) => {
        if (patch.date !== undefined) event.date = patch.date.trim();
        if (patch.time !== undefined) {
          if (patch.time === null || !patch.time.trim()) delete event.time;
          else event.time = patch.time.trim();
        }
        if (patch.title !== undefined) event.title = patch.title.trim();
        if (patch.description !== undefined)
          event.description = patch.description;
        if (patch.characterIds !== undefined) {
          event.characterIds = [...new Set(patch.characterIds)];
        }
        if (patch.locationId !== undefined) {
          if (patch.locationId === null) delete event.locationId;
          else event.locationId = patch.locationId;
        }
        if (patch.linkedChapterId !== undefined) {
          if (patch.linkedChapterId === null)
            delete event.linkedChapterId;
          else event.linkedChapterId = patch.linkedChapterId;
        }
        if (patch.linkedSceneId !== undefined) {
          if (patch.linkedSceneId === null) delete event.linkedSceneId;
          else event.linkedSceneId = patch.linkedSceneId;
        }
        if (patch.arcIds !== undefined) {
          event.arcIds = [...new Set(patch.arcIds)];
        }
        if (patch.stateChanges !== undefined) {
          event.stateChanges = patch.stateChanges;
        }
        event.updatedAt = nowIso();
      });
    const updated = await getDatabase().timelineEvents.get(id);
    if (!updated) throw new Error(`TimelineEvent not found: ${id}`);
    return updated;
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().timelineEvents.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .timelineEvents.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().timelineEvents.delete(id);
  }

  async listDeleted(): Promise<TimelineEvent[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .timelineEvents.filter((event) => Boolean(event.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const timelineEventRepository: TimelineEventRepository =
  new DexieTimelineEventRepository();
