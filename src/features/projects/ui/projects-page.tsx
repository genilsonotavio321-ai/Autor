"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { projectRepository } from "../infra/dexie-project-repository";
import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";

export function ProjectsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const projects = useLiveQuery(() => projectRepository.listActive(), []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Seus romances, contos e rascunhos.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus aria-hidden />
          Novo projeto
        </Button>
      </header>

      {projects === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-serif text-lg">Nenhum projeto ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro projeto e comece a escrever.
          </p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden />
            Novo projeto
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(project) => router.push(`/projects/${project.id}`)}
      />
    </div>
  );
}
