"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Frame, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useUiStore } from "@/shared/store/ui-store";

import { PROJECT_STATUS_LABELS } from "../domain/repository";
import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";
import { ChapterList } from "./chapter-list";
import { ProjectFormDialog } from "./project-form-dialog";

interface ProjectDetailPageProps {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const router = useRouter();
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );
  const [editOpen, setEditOpen] = useState(false);
  // `null` (not `undefined`) marks "not found" — useLiveQuery uses undefined
  // both for "loading" and for a query that resolved to undefined.
  const project = useLiveQuery(
    () => projectRepository.getById(projectId).then((p) => p ?? null),
    [projectId],
    null,
  );
  const chapters = useLiveQuery(
    () => chapterRepository.listByProject(projectId),
    [projectId],
  );

  // Abrir a página de um projeto (inclusive deep link) o seleciona como
  // projeto carregado no app.
  useEffect(() => {
    if (project && !project.deletedAt) setSelectedProjectId(project.id);
  }, [project, setSelectedProjectId]);

  if (project === undefined || chapters === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!project || project.deletedAt) {
    return (
      <EmptyState
        className="mx-auto max-w-md"
        title="Projeto não encontrado"
        hint="Ele pode ter sido excluído ou estar na lixeira."
      >
        <Button asChild variant="outline">
          <Link href="/projects">
            <ArrowLeft aria-hidden />
            Voltar para projetos
          </Link>
        </Button>
      </EmptyState>
    );
  }

  const activeChapters = chapters.filter((chapter) => !chapter.archived);
  const archivedChapters = chapters.filter((chapter) => chapter.archived);

  const archive = async () => {
    const next = project.status === "archived" ? "active" : "archived";
    await projectRepository.update(project.id, { status: next });
    toast.success(
      next === "archived" ? "Projeto arquivado" : "Projeto reativado",
    );
  };

  const remove = async () => {
    await projectRepository.softDelete(project.id);
    toast(`"${project.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void projectRepository.restore(project.id);
        },
      },
    });
    router.push("/projects");
  };

  const addChapter = async () => {
    const chapter = await chapterRepository.create({ projectId });
    toast(`"${chapter.title}" criado`, {
      action: {
        label: "Abrir",
        onClick: () => router.push(`/write/${chapter.id}`),
      },
    });
  };

  return (
    <div className="space-y-8">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
      >
        <ArrowLeft aria-hidden />
        Projetos
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="display-title">
              {project.title}
            </h1>
            <Badge variant="outline">
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>
          {project.subtitle ? (
            <p className="lead mt-1">{project.subtitle}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {project.author ? `${project.author} · ` : ""}
            atualizado {formatRelativeTime(project.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedProjectId(project.id);
              router.push("/canvas");
            }}
          >
            <Frame aria-hidden />
            Canvas
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void archive()}>
                {project.status === "archived"
                  ? "Reativar projeto"
                  : "Arquivar projeto"}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
                <Trash2 aria-hidden />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {project.description ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Capítulos
          </h2>
          <Button onClick={() => void addChapter()}>
            <Plus aria-hidden />
            Novo capítulo
          </Button>
        </div>
        <ChapterList chapters={activeChapters} />
      </section>

      {archivedChapters.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              Arquivados
            </h2>
            <Badge variant="outline">{archivedChapters.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Capítulos guardados dentro do projeto — fora da escrita, mas sempre
            à mão.
          </p>
          <ChapterList chapters={archivedChapters} />
        </section>
      ) : null}

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
    </div>
  );
}
