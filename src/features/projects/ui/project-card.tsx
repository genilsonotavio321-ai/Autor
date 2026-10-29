"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useUiStore } from "@/shared/store/ui-store";
import type { Project } from "@/shared/types/database";

import { PROJECT_STATUS_LABELS } from "../domain/repository";

const STATUS_VARIANT: Record<
  Project["status"],
  "default" | "secondary" | "outline"
> = {
  active: "default",
  draft: "secondary",
  completed: "outline",
  archived: "outline",
};

/** Extra tint per status — "Concluído" reads as success (same as chapter "done"). */
const STATUS_CLASS: Record<Project["status"], string> = {
  active: "",
  draft: "",
  completed:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  archived: "",
};

export interface ProjectStats {
  chapterCount: number;
  wordCount: number;
  readingMinutes: number;
}

function statsLine(stats: ProjectStats, project: Project): string {
  const parts = [
    `${stats.chapterCount} ${stats.chapterCount === 1 ? "capítulo" : "capítulos"}`,
    `${stats.wordCount.toLocaleString("pt-BR")} palavras`,
    `${stats.readingMinutes} min de leitura`,
  ];
  if (project.author) parts.unshift(project.author);
  return parts.join(" · ");
}

export function ProjectCard({
  project,
  stats,
}: {
  project: Project;
  stats?: ProjectStats;
}) {
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );

  return (
    <Link
      href={`/projects/${project.id}`}
      // Abrir um projeto também o seleciona como projeto carregado no app.
      onClick={() => setSelectedProjectId(project.id)}
      className="group block h-full"
    >
      <Card className="relative h-full transition-colors group-hover:border-primary/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 font-serif text-lg text-primary"
            >
              {project.title.charAt(0).toUpperCase()}
            </div>
            <Badge
              variant={STATUS_VARIANT[project.status]}
              className={STATUS_CLASS[project.status]}
            >
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <CardTitle className="font-serif">{project.title}</CardTitle>
          {project.subtitle ? (
            <CardDescription>{project.subtitle}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-1">
          {stats ? (
            <p className="text-sm text-muted-foreground">
              {statsLine(stats, project)}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            atualizado {formatRelativeTime(project.updatedAt)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Compact horizontal variant used by the stacked ("list") layout. */
export function ProjectRow({
  project,
  stats,
}: {
  project: Project;
  stats?: ProjectStats;
}) {
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );
  return (
    <Link
      href={`/projects/${project.id}`}
      // Abrir um projeto também o seleciona como projeto carregado no app.
      onClick={() => setSelectedProjectId(project.id)}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 font-serif text-lg text-primary"
      >
        {project.title.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif font-medium">{project.title}</p>
        {stats ? (
          <p className="truncate text-xs text-muted-foreground">
            {statsLine(stats, project)}
          </p>
        ) : project.subtitle ? (
          <p className="truncate text-xs text-muted-foreground">
            {project.subtitle}
          </p>
        ) : null}
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatRelativeTime(project.updatedAt)}
      </span>
      <Badge
        variant={STATUS_VARIANT[project.status]}
        className={`shrink-0 ${STATUS_CLASS[project.status]}`}
      >
        {PROJECT_STATUS_LABELS[project.status]}
      </Badge>
    </Link>
  );
}
