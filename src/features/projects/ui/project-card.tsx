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
import type { Project } from "@/shared/types/database";

import { PROJECT_STATUS_LABELS } from "../domain/repository";

const STATUS_VARIANT: Record<
  Project["status"],
  "default" | "secondary" | "outline"
> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
};

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block h-full">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 font-serif text-lg text-primary"
            >
              {project.title.charAt(0).toUpperCase()}
            </div>
            <Badge variant={STATUS_VARIANT[project.status]}>
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <CardTitle className="font-serif">{project.title}</CardTitle>
          {project.subtitle ? (
            <CardDescription>{project.subtitle}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {project.author ? `${project.author} · ` : ""}
            atualizado {formatRelativeTime(project.updatedAt)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
