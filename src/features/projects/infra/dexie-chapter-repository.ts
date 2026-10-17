import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { countDocWords } from "@/features/editor/domain/word-count";
import type { Chapter, EntityId, Json } from "@/shared/types/database";

import { EMPTY_DOC } from "../domain/repository";
import type {
  ChapterCreateInput,
  ChapterRepository,
  ChapterUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieChapterRepository implements ChapterRepository {
  async create(input: ChapterCreateInput): Promise<Chapter> {
    await ensureDbReady();
    const db = getDatabase();
    const existing = await db.chapters
      .filter((chapter) => chapter.projectId === input.projectId)
      .toArray();
    const order =
      existing.reduce((max, chapter) => Math.max(max, chapter.order), 0) + 1;
    const now = nowIso();
    const content: Json = input.content
      ? structuredClone(input.content)
      : structuredClone(EMPTY_DOC);
    const chapter: Chapter = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      title: input.title?.trim() || `Capítulo ${order}`,
      order,
      status: "todo",
      wordCount: countDocWords(content),
      content,
      createdAt: now,
      updatedAt: now,
    };
    await db.chapters.add(chapter);
    return chapter;
  }

  async getById(id: EntityId): Promise<Chapter | undefined> {
    await ensureDbReady();
    return getDatabase().chapters.get(id);
  }

  async listByProject(projectId: EntityId): Promise<Chapter[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .chapters.filter(
        (chapter) => chapter.projectId === projectId && !chapter.deletedAt,
      )
      .toArray();
    return all.sort((a, b) => a.order - b.order);
  }

  async update(id: EntityId, patch: ChapterUpdateInput): Promise<Chapter> {
    await ensureDbReady();
    await getDatabase().chapters.update(id, { ...patch, updatedAt: nowIso() });
    const updated = await getDatabase().chapters.get(id);
    if (!updated) throw new Error(`Chapter not found: ${id}`);
    return updated;
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().chapters.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .chapters.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }
}

export const chapterRepository: ChapterRepository = new DexieChapterRepository();
