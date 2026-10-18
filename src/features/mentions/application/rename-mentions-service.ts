import { countDocWords } from "@/features/editor/domain/word-count";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import type { EntityId } from "@/shared/types/database";

import { renameMentionsInContent } from "../domain/rename-mentions";

/**
 * Reescreve as menções ao nome antigo nos capítulos e cenas do projeto,
 * devolvendo quantos trechos foram alterados (0 = nada a fazer).
 */
export async function renameMentionsInProject(
  projectId: EntityId,
  oldName: string,
  newName: string,
): Promise<number> {
  const from = oldName.trim();
  const to = newName.trim();
  if (from.length < 2 || from === to) return 0;

  let count = 0;

  const chapters = await chapterRepository.listByProject(projectId);
  for (const chapter of chapters) {
    const { content, count: changed } = renameMentionsInContent(
      chapter.content,
      from,
      to,
    );
    if (changed === 0) continue;
    count += changed;
    await chapterRepository.update(chapter.id, {
      content,
      wordCount: countDocWords(content),
    });
  }

  const scenes = await sceneRepository.listByProject(projectId);
  for (const scene of scenes) {
    const { content, count: changed } = renameMentionsInContent(
      scene.content,
      from,
      to,
    );
    if (changed === 0) continue;
    count += changed;
    await sceneRepository.update(scene.id, { content });
  }

  return count;
}
