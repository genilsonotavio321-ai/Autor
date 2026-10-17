"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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

  if (project === undefined || chapters === undefined) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!project || project.deletedAt) {
    return (
      <div className="mx-auto max-w-4xl rounded-lg border border-dashed p-10 text-center">
        <p className="font-serif text-lg">Projeto não encontrado</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/projects">
            <ArrowLeft aria-hidden />
            Voltar para projetos
          </Link>
        </Button>
      </div>
    );
  }

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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden />
        Projetos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold">
              {project.title}
            </h1>
            <Badge variant="outline">
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>
          {project.subtitle ? (
            <p className="text-muted-foreground">{project.subtitle}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {project.author ? `${project.author} · ` : ""}
            atualizado {formatRelativeTime(project.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                Mover para lixeira
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
          <h2 className="font-serif text-xl font-semibold">Capítulos</h2>
          <Button onClick={() => void addChapter()}>
            <Plus aria-hidden />
            Novo capítulo
          </Button>
        </div>
        <ChapterList chapters={chapters} />
      </section>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
    </div>
  );
}
