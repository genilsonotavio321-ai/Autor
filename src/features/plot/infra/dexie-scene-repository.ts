import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, Scene } from "@/shared/types/database";

import { EMPTY_SCENE_DOC } from "../domain/repository";
import type {
  SceneCreateInput,
  SceneMoveUpdate,
  SceneRepository,
  SceneUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieSceneRepository implements SceneRepository {
  async create(input: SceneCreateInput): Promise<Scene> {
    await ensureDbReady();
    const db = getDatabase();
    const existing = await db.scenes
      .filter((scene) => scene.chapterId === input.chapterId)
      .toArray();
    const order =
      existing.reduce((max, scene) => Math.max(max, scene.order), 0) + 1;
    const now = nowIso();
    const scene: Scene = {
      id: createId(),
      chapterId: input.chapterId,
      title: input.title?.trim() || `Cena ${order}`,
      order,
      summary: input.summary,
      content: structuredClone(EMPTY_SCENE_DOC),
      status: input.status ?? "todo",
      createdAt: now,
      updatedAt: now,
    };
    await db.scenes.add(scene);
    return scene;
  }

  async getById(id: EntityId): Promise<Scene | undefined> {
    await ensureDbReady();
    return getDatabase().scenes.get(id);
  }

  async listByChapter(chapterId: EntityId): Promise<Scene[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .scenes.filter(
        (scene) => scene.chapterId === chapterId && !scene.deletedAt,
      )
      .toArray();
    return all.sort((a, b) => a.order - b.order);
  }

  async listByProject(projectId: EntityId): Promise<Scene[]> {
    await ensureDbReady();
    const db = getDatabase();
    const chapters = await db.chapters
      .filter((chapter) => chapter.projectId === projectId && !chapter.deletedAt)
      .toArray();
    // Table scans come back in primary-key (UUID) order — sort by the
    // chapter's narrative order before building the rank map.
    chapters.sort((a, b) => a.order - b.order);
    const chapterOrder = new Map(chapters.map((c, i) => [c.id, i]));
    const chapterIds = new Set(chapters.map((c) => c.id));
    const scenes = await db.scenes
      .filter(
        (scene) => chapterIds.has(scene.chapterId) && !scene.deletedAt,
      )
      .toArray();
    return scenes.sort((a, b) => {
      const ca = chapterOrder.get(a.chapterId) ?? 0;
      const cb = chapterOrder.get(b.chapterId) ?? 0;
      if (ca !== cb) return ca - cb;
      return a.order - b.order;
    });
  }

  async update(id: EntityId, patch: SceneUpdateInput): Promise<Scene> {
    await ensureDbReady();
    await getDatabase().scenes.update(id, { ...patch, updatedAt: nowIso() });
    const updated = await getDatabase().scenes.get(id);
    if (!updated) throw new Error(`Scene not found: ${id}`);
    return updated;
  }

  async applyMoves(updates: SceneMoveUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.scenes, async () => {
      for (const move of updates) {
        await db.scenes.update(move.id, {
          chapterId: move.chapterId,
          order: move.order,
          updatedAt: nowIso(),
        });
      }
    });
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().scenes.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .scenes.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }
}

export const sceneRepository: SceneRepository = new DexieSceneRepository();
