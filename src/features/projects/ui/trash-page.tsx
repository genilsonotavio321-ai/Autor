"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/shared/lib/dates";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";

import { restoreProject } from "../application/project-service";
import { projectRepository } from "../infra/dexie-project-repository";

export function TrashPage() {
  const deletedProjects = useLiveQuery(
    () => projectRepository.listDeleted(),
    [],
  );
  const deletedNotes = useLiveQuery(() => noteRepository.listDeleted(), []);

  async function restoreProjectById(id: string, title: string) {
    await restoreProject(id);
    toast.success(`"${title}" restaurado`);
  }

  async function restoreNoteById(id: string, title: string) {
    await noteRepository.restore(id);
    toast.success(`"${title}" restaurada`);
  }

  const loading = deletedProjects === undefined || deletedNotes === undefined;
  const empty =
    (deletedProjects?.length ?? 0) === 0 && (deletedNotes?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Lixeira</h1>
        <p className="text-sm text-muted-foreground">
          Itens excluídos ficam aqui e podem ser restaurados.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : empty ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          A lixeira está vazia.
        </div>
      ) : (
        <>
          {(deletedProjects?.length ?? 0) > 0 ? (
            <section aria-labelledby="trash-projects" className="space-y-2">
              <h2 id="trash-projects" className="text-sm font-medium">
                Projetos
              </h2>
              <ul className="divide-y rounded-lg border">
                {deletedProjects?.map((project) => (
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
                      onClick={() =>
                        void restoreProjectById(project.id, project.title)
                      }
                    >
                      <RotateCcw aria-hidden />
                      Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(deletedNotes?.length ?? 0) > 0 ? (
            <section aria-labelledby="trash-notes" className="space-y-2">
              <h2 id="trash-notes" className="text-sm font-medium">
                Notas
              </h2>
              <ul className="divide-y rounded-lg border">
                {deletedNotes?.map((note) => (
                  <li key={note.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{note.title}</p>
                      <p className="text-xs text-muted-foreground">
                        excluída em {formatDateTime(note.deletedAt ?? "")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void restoreNoteById(note.id, note.title)}
                    >
                      <RotateCcw aria-hidden />
                      Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
