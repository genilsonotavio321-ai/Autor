import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import { listDeletedRows, nowIso, restoreRow, softDeleteRow } from "@/shared/lib/dexie-trash";
import { countDocWords } from "@/features/editor/domain/word-count";
import type { Chapter, EntityId, Json } from "@/shared/types/database";

import { EMPTY_DOC } from "../domain/repository";
import type {
  ChapterCreateInput,
  ChapterRepository,
  ChapterUpdateInput,
} from "../domain/repository";

export class DexieChapterRepository implements ChapterRepository {
  async create(input: ChapterCreateInput): Promise<Chapter> {
    await ensureDbReady();
    const db = getDatabase();
    // Ignora capítulos na lixeira: sem isso, excluir o cap. 6 faria o próximo
    // receber a order 7 mesmo com 5 capítulos visíveis.
    // Índice `projectId` (schema v8): varredura deixou de ser tabela inteira.
    const existing = await db.chapters
      .where("projectId")
      .equals(input.projectId)
      .filter((chapter) => !chapter.deletedAt)
      .toArray();
    const order =
      existing.reduce((max, chapter) => Math.max(max, chapter.order), 0) + 1;
    const now = nowIso();
    const content: Json = input.content
      ? structuredClone(input.content)
      : structuredClone(EMPTY_DOC);
    const chapter: Chapter = {
      id: createId(),
      projectId: input.projectId,
      // Título padrão único: a numeração visível fica a cargo da lista
      // (posição do capítulo), não do nome.
      title: input.title?.trim() || "Novo capítulo",
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
      .chapters.where("projectId")
      .equals(projectId)
      .filter((chapter) => !chapter.deletedAt)
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
    await softDeleteRow(getDatabase().chapters, id);
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    await restoreRow(getDatabase().chapters, id);
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().chapters.delete(id);
  }

  async listDeleted(): Promise<Chapter[]> {
    await ensureDbReady();
    return listDeletedRows(getDatabase().chapters);
  }
}

export const chapterRepository: ChapterRepository = new DexieChapterRepository();
