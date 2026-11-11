"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { estimateReadingMinutes } from "@/features/productivity/domain/writing-log";
import { PROJECTS_SORT_LABELS, useUiStore } from "@/shared/store/ui-store";

import { sortProjectEntries, type ProjectEntry } from "../domain/sorting";
import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";
import { ProjectCard, ProjectRow } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";

type ProjectsTab = "active" | "archived";

export function ProjectsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<ProjectsTab>("active");

  const projectsSort = useUiStore((state) => state.projectsSort);
  const projectsLayout = useUiStore((state) => state.projectsLayout);
  const setProjectsSort = useUiStore((state) => state.setProjectsSort);
  const setProjectsLayout = useUiStore((state) => state.setProjectsLayout);
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );

  const entries = useLiveQuery(async (): Promise<ProjectEntry[]> => {
    const projects = await projectRepository.listActive();
    return Promise.all(
      projects.map(async (project) => {
        const chapters = await chapterRepository.listByProject(project.id);
        const wordCount = chapters.reduce(
          (sum, chapter) => sum + chapter.wordCount,
          0,
        );
        return {
          project,
          chapterCount: chapters.length,
          wordCount,
          readingMinutes: estimateReadingMinutes(wordCount),
        };
      }),
    );
  }, []);

  const sorted = entries ? sortProjectEntries(entries, projectsSort) : undefined;

  const visible = sorted?.filter(({ project }) =>
    tab === "archived"
      ? project.status === "archived"
      : project.status !== "archived",
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            Biblioteca
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Projetos
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Seus romances, contos e rascunhos.
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => setDialogOpen(true)}
        >
          <Plus aria-hidden />
          Novo projeto
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as ProjectsTab)}
        >
          <TabsList>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="archived">Arquivados</TabsTrigger>
          </TabsList>
        </Tabs>

        {visible && visible.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={projectsSort}
              onValueChange={(value) =>
                setProjectsSort(value as typeof projectsSort)
              }
            >
              <SelectTrigger
                id="projects-sort"
                className="h-9 w-52"
                aria-label="Ordenar projetos"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECTS_SORT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              role="group"
              aria-label="Disposição dos projetos"
              className="flex items-center gap-0.5 rounded-full border border-border/70 p-0.5"
            >
              <Button
                variant={projectsLayout === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="size-8 rounded-full"
                aria-label="Exibir em caixas"
                aria-pressed={projectsLayout === "grid"}
                onClick={() => setProjectsLayout("grid")}
              >
                <LayoutGrid aria-hidden />
              </Button>
              <Button
                variant={projectsLayout === "list" ? "secondary" : "ghost"}
                size="icon"
                className="size-8 rounded-full"
                aria-label="Exibir em lista"
                aria-pressed={projectsLayout === "list"}
                onClick={() => setProjectsLayout("list")}
              >
                <List aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {visible === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        tab === "archived" ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-10 text-center">
            <p className="font-serif text-xl tracking-tight">Nenhum projeto arquivado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Projetos arquivados ficam guardados aqui.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-10 text-center">
            <p className="font-serif text-xl tracking-tight">Nenhum projeto ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie seu primeiro projeto e comece a escrever.
            </p>
            <Button className="mt-4 rounded-full" onClick={() => setDialogOpen(true)}>
              <Plus aria-hidden />
              Novo projeto
            </Button>
          </div>
        )
      ) : projectsLayout === "list" ? (
        <div className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card/40 ring-1 ring-border/70">
          {visible.map(({ project, ...stats }) => (
            <ProjectRow key={project.id} project={project} stats={stats} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ project, ...stats }) => (
            <ProjectCard key={project.id} project={project} stats={stats} />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(project) => {
          // Criar um projeto já o seleciona como projeto carregado no app.
          setSelectedProjectId(project.id);
          router.push(`/projects/${project.id}`);
        }}
      />
    </div>
  );
}
