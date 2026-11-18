"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  Frame,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageActionBar } from "@/components/layout/action-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useUiStore } from "@/shared/store/ui-store";

import { useProjectReady } from "../application/use-project-ready";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Capítulos arquivados só aparecem quando o usuário pede para revelar.
  const [showArchived, setShowArchived] = useState(false);
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
  useProjectReady(chapters !== undefined, projectId);

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
  };

  const remove = async () => {
    await projectRepository.softDelete(project.id);
    router.push("/projects");
  };

  const addChapter = async () => {
    await chapterRepository.create({ projectId });
  };

  const archived = project.status === "archived";

  return (
    <div className="space-y-8">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
      >
        <ArrowLeft aria-hidden />
        Projetos
      </Link>

      <PageActionBar>
        <Button
          size="icon"
          className="rounded-full"
          aria-label="Novo capítulo"
          title="Novo capítulo"
          onClick={() => void addChapter()}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Canvas"
          title="Canvas"
          onClick={() => {
            setSelectedProjectId(project.id);
            router.push("/canvas");
          }}
        >
          <Frame aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Editar projeto"
          title="Editar projeto"
          onClick={() => setEditOpen(true)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label={archived ? "Reativar projeto" : "Arquivar projeto"}
          title={archived ? "Reativar projeto" : "Arquivar projeto"}
          onClick={() => void archive()}
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full text-destructive"
          aria-label="Excluir projeto"
          title="Excluir projeto"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 aria-hidden />
        </Button>
      </PageActionBar>

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
      </header>

      {project.description ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Capítulos
        </h2>
        <ChapterList chapters={activeChapters} />
      </section>

      {archivedChapters.length > 0 ? (
        <section className="space-y-3">
          <Button
            variant="ghost"
            className="gap-2 rounded-full px-3"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((value) => !value)}
          >
            <ChevronDown
              aria-hidden
              className={`size-4 transition-transform ${showArchived ? "rotate-180" : ""}`}
            />
            {showArchived ? "Ocultar arquivados" : "Revelar arquivados"}
            <Badge variant="outline">{archivedChapters.length}</Badge>
          </Button>
          {showArchived ? (
            <>
              <p className="text-sm text-muted-foreground">
                Capítulos guardados dentro do projeto — fora da escrita, mas
                sempre à mão.
              </p>
              <ChapterList chapters={archivedChapters} sortable={false} />
            </>
          ) : null}
        </section>
      ) : null}

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{project.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto e todo o seu conteúdo vão para a lixeira. Você pode
              restaurar depois em Lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
