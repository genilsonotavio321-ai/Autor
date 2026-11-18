"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { useProjectReady } from "@/features/projects/application/use-project-ready";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";

import { IdeaCanvas } from "./idea-canvas";

/** Rota /canvas: o board é a página inteira; ações vivem no menu flutuante. */
export function CreativityPage() {
  const { projectId } = useSelectedProject();
  const liveChapters = useLiveQuery(
    () => (projectId ? chapterRepository.listByProject(projectId) : []),
    [projectId],
  );
  useProjectReady(liveChapters !== undefined, projectId);
  const chapters = liveChapters ?? [];

  if (projectId === null) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          title="Nenhum projeto ativo"
          hint="Crie um projeto para começar a gerar ideias."
        >
          <Button asChild>
            <Link href="/projects">Ir para Projetos</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  // key: trocar de projeto remonta o canvas — o quadro ativo não pode
  // autosalvar cards de outro projeto no quadro deste.
  return (
    <IdeaCanvas key={projectId} projectId={projectId} chapters={chapters} />
  );
}
