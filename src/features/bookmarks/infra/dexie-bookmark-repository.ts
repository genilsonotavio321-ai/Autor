import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { Bookmark, EntityId } from "@/shared/types/database";

export interface CreateBookmarkInput {
  projectId: EntityId;
  chapterId: EntityId;
  /** Offset ProseMirror do ponto marcado. */
  position: number;
  excerpt: string;
}

export interface BookmarkRepository {
  /** Marcadores de um capítulo, na ordem do texto. */
  listByChapter(chapterId: EntityId): Promise<Bookmark[]>;
  create(input: CreateBookmarkInput): Promise<Bookmark>;
  remove(id: EntityId): Promise<void>;
  removeByChapter(chapterId: EntityId): Promise<void>;
  removeByProject(projectId: EntityId): Promise<void>;
}

export class DexieBookmarkRepository implements BookmarkRepository {
  async listByChapter(chapterId: EntityId): Promise<Bookmark[]> {
    await ensureDbReady();
    const rows = await getDatabase()
      .bookmarks.where("chapterId")
      .equals(chapterId)
      .toArray();
    return rows.sort((a, b) => a.position - b.position);
  }

  async create(input: CreateBookmarkInput): Promise<Bookmark> {
    await ensureDbReady();
    const bookmark: Bookmark = {
      id: createId(),
      projectId: input.projectId,
      chapterId: input.chapterId,
      position: input.position,
      excerpt: input.excerpt,
      createdAt: new Date().toISOString(),
    };
    await getDatabase().bookmarks.add(bookmark);
    return bookmark;
  }

  async remove(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().bookmarks.delete(id);
  }

  async removeByChapter(chapterId: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().bookmarks.where("chapterId").equals(chapterId).delete();
  }

  async removeByProject(projectId: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().bookmarks.where("projectId").equals(projectId).delete();
  }
}

export const bookmarkRepository: BookmarkRepository =
  new DexieBookmarkRepository();
