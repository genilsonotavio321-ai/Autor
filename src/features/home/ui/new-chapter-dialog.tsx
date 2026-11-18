"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, FileText } from "lucide-react";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { useUiStore } from "@/shared/store/ui-store";
import type { Project } from "@/shared/types/database";

interface NewChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Novo capítulo" da página inicial: escolhe o projeto, cria o capítulo na
 * hora e leva direto ao editor. Projetos arquivados ficam numa região
 * expansível.
 */
export function NewChapterDialog({ open, onOpenChange }: NewChapterDialogProps) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const projects = useLiveQuery(() => projectRepository.listActive(), []);
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );

  const active = (projects ?? []).filter(
    (project) => project.status !== "archived",
  );
  const archived = (projects ?? []).filter(
    (project) => project.status === "archived",
  );

  async function createIn(project: Project) {
    if (creating) return;
    setCreating(true);
    try {
      const chapter = await chapterRepository.create({ projectId: project.id });
      setSelectedProjectId(project.id);
      onOpenChange(false);
      router.push(`/write/${chapter.id}`);
    } catch {
    } finally {
      setCreating(false);
    }
  }

  function projectButton(project: Project) {
    return (
      <Button
        key={project.id}
        type="button"
        variant="outline"
        className="h-auto w-full justify-start gap-2 py-2.5"
        disabled={creating}
        onClick={() => void createIn(project)}
      >
        <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">
          {project.title}
        </span>
        {project.status === "archived" ? (
          <Badge variant="outline">arquivado</Badge>
        ) : null}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo capítulo</DialogTitle>
          <DialogDescription>
            Escolha o projeto que recebe o capítulo. Ele abre direto no editor.
          </DialogDescription>
        </DialogHeader>

        {projects === undefined ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10 rounded-md" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum projeto ainda. Crie uma história primeiro.
          </p>
        ) : (
          <div className="grid gap-2">
            {active.map(projectButton)}
            {archived.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start gap-2 px-2 text-muted-foreground"
                  aria-expanded={showArchived}
                  onClick={() => setShowArchived((value) => !value)}
                >
                  <ChevronDown
                    aria-hidden
                    className={`size-4 transition-transform ${showArchived ? "rotate-180" : ""}`}
                  />
                  {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
                  <Badge variant="outline">{archived.length}</Badge>
                </Button>
                {showArchived ? <div className="grid gap-2">{archived.map(projectButton)}</div> : null}
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
