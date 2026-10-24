"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [tab, setTab] = useState("outline");
  // Deep link /outline?scene=<id> abre o SceneDialog direto (padrão house).
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get("scene");
    if (!sceneId) return;
    setTab("outline");
    setPendingSceneId(sceneId);
    window.history.replaceState({}, "", "/outline");
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Estrutura"
        count={
          projectId && chapters.length > 0
            ? `${chapters.length} ${chapters.length === 1 ? "capítulo" : "capítulos"}`
            : undefined
        }
      >
      </PageHeader>

      {projectId === null ? (
        <EmptyState>
          <p className="mb-4">
            Crie um projeto para começar a planejar a estrutura.
          </p>
          <Button asChild>
            <Link href="/projects">Ir para Projetos</Link>
          </Button>
        </EmptyState>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="beats">Beats</TabsTrigger>
            <TabsTrigger value="corkboard">Corkboard</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
          <TabsContent value="outline" className="pt-4">
            <OutlineTree
              projectId={projectId}
              chapters={chapters}
              pendingSceneId={pendingSceneId}
              onPendingSceneConsumed={() => setPendingSceneId(null)}
            />
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
