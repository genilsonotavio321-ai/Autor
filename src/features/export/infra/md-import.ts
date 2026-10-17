import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { markdownToDoc, splitMarkdownChapters } from "@/features/export/domain/markdown";
import type { EntityId } from "@/shared/types/database";

export interface ImportResult {
  count: number;
  titles: string[];
}

/**
 * Imports Markdown (ideally an export produced by this app) as new chapters
 * of the given project. One level-1 heading = one chapter; the front-matter
 * heading of an export is skipped automatically by `splitMarkdownChapters`.
 */
export async function importMarkdownFile(
  projectId: EntityId,
  filename: string,
  text: string,
): Promise<ImportResult> {
  const chunks = splitMarkdownChapters(text);
  if (chunks.length === 0) {
    throw new Error("Nenhum conteúdo encontrado no arquivo.");
  }

  const fallbackTitle = filename.replace(/\.[^.]+$/, "").trim();
  const titles: string[] = [];

  for (const chunk of chunks) {
    const title = chunk.title || fallbackTitle || "Capítulo importado";
    const chapter = await chapterRepository.create({
      projectId,
      title,
      content: markdownToDoc(chunk.markdown),
    });
    titles.push(chapter.title);
  }

  return { count: titles.length, titles };
}
