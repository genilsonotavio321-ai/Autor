"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useUiStore } from "@/shared/store/ui-store";
import type { Project } from "@/shared/types/database";

import { PROJECT_STATUS_LABELS } from "../domain/repository";

/** Extra tint per status — "Concluído" reads as success (same as chapter "done"). */
const STATUS_CLASS: Record<Project["status"], string> = {
  active: "",
  draft: "",
  completed:
    "border-emerald-300/70 bg-emerald-50/70 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
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
      className="group block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <article className="relative flex h-full flex-col gap-5 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent/40 group-hover:ring-border">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-serif text-lg text-foreground/80"
          >
            {project.title.charAt(0).toUpperCase()}
          </span>
          <Badge
            variant="outline"
            className={cn("rounded-full text-[11px] font-normal", STATUS_CLASS[project.status])}
          >
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        <div className="space-y-1">
          <h3 className="font-serif text-xl leading-snug font-semibold tracking-tight">
            {project.title}
          </h3>
          {project.subtitle ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {project.subtitle}
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-1 text-xs text-muted-foreground">
          {stats ? <p>{statsLine(stats, project)}</p> : null}
          <p>atualizado {formatRelativeTime(project.updatedAt)}</p>
        </div>
      </article>
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
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-serif text-base text-foreground/80"
      >
        {project.title.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-base font-medium tracking-tight">
          {project.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {stats
            ? statsLine(stats, project)
            : project.subtitle || `atualizado ${formatRelativeTime(project.updatedAt)}`}
        </p>
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatRelativeTime(project.updatedAt)}
      </span>
      <Badge
        variant="outline"
        className={cn("shrink-0 rounded-full text-[11px] font-normal", STATUS_CLASS[project.status])}
      >
        {PROJECT_STATUS_LABELS[project.status]}
      </Badge>
    </Link>
  );
}
