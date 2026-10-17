"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/shared/lib/dates";

import { restoreProject } from "../application/project-service";
import { projectRepository } from "../infra/dexie-project-repository";

export function TrashPage() {
  const deleted = useLiveQuery(() => projectRepository.listDeleted(), []);

  async function restore(id: string, title: string) {
    await restoreProject(id);
    toast.success(`"${title}" restaurado`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Lixeira</h1>
        <p className="text-sm text-muted-foreground">
          Projetos excluídos ficam aqui e podem ser restaurados.
        </p>
      </header>

      {deleted === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : deleted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          A lixeira está vazia.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {deleted.map((project) => (
            <li key={project.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{project.title}</p>
                <p className="text-xs text-muted-foreground">
                  excluído em {formatDateTime(project.deletedAt ?? "")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void restore(project.id, project.title)}
              >
                <RotateCcw aria-hidden />
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
