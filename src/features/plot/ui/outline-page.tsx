"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";

import { BeatsPanel } from "./beats-panel";
import { Corkboard } from "./corkboard";
import { Kanban } from "./kanban";
import { OutlineTree } from "./outline-tree";

export function OutlinePage() {
  const { projectId } = useSelectedProject();
  const chapters =
    useLiveQuery(
      () => (projectId ? chapterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl">Estrutura</h1>
          {projectId ? (
            <Badge variant="outline">{chapters.length} capítulos</Badge>
          ) : null}
        </div>
        <ProjectPicker />
      </header>

      {projectId === null ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Crie um projeto para começar a planejar a estrutura.
          </p>
          <Button asChild>
            <Link href="/projects">Ir para Projetos</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="outline">
          <TabsList>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="beats">Beats</TabsTrigger>
            <TabsTrigger value="corkboard">Corkboard</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
          <TabsContent value="outline" className="pt-4">
            <OutlineTree projectId={projectId} chapters={chapters} />
          </TabsContent>
          <TabsContent value="beats" className="pt-4">
            <BeatsPanel projectId={projectId} chapters={chapters} />
          </TabsContent>
          <TabsContent value="corkboard" className="pt-4">
            <Corkboard projectId={projectId} chapters={chapters} />
          </TabsContent>
          <TabsContent value="kanban" className="pt-4">
            <Kanban projectId={projectId} chapters={chapters} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
