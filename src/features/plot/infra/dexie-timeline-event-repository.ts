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
      title: input.title.trim(),
      description: input.description,
      characterIds: [],
      linkedChapterId: input.linkedChapterId,
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
    return all.sort((a, b) => a.date.localeCompare(b.date));
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
        if (patch.title !== undefined) event.title = patch.title.trim();
        if (patch.description !== undefined)
          event.description = patch.description;
        if (patch.linkedChapterId !== undefined) {
          if (patch.linkedChapterId === null)
            delete event.linkedChapterId;
          else event.linkedChapterId = patch.linkedChapterId;
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
}

export const timelineEventRepository: TimelineEventRepository =
  new DexieTimelineEventRepository();
