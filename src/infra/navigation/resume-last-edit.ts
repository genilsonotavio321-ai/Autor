import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";

/** Marca que a retomada já rodou nesta carga da página. */
export const RESUME_GUARD_KEY = "autor-resume-done";

/**
 * Rota onde o usuário parou de escrever: o `lastEdit` mais recente entre os
 * projetos vivos. Se o capítulo salvo não puder ser aberto (apagado,
 * arquivado ou projeto sumido), devolve `null` e o app fica em Início — só o
 * capítulo que ainda pode ser escrito justifica a retomada.
 */
export async function resolveResumeRoute(): Promise<string | null> {
  const projects = await projectRepository.listActive();
  let latest: { chapterId: string; projectId: string; updatedAt: string } | null =
    null;
  for (const project of projects) {
    const lastEdit = project.lastEdit;
    if (!lastEdit) continue;
    if (!latest || lastEdit.updatedAt > latest.updatedAt) {
      latest = {
        chapterId: lastEdit.chapterId,
        projectId: project.id,
        updatedAt: lastEdit.updatedAt,
      };
    }
  }
  if (!latest) return null;

  const chapter = await chapterRepository.getById(latest.chapterId);
  if (chapter && !chapter.deletedAt && !chapter.archived) {
    return `/write/${chapter.id}`;
  }
  return null;
}
