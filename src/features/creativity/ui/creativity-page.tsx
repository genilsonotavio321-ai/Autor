"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";

import { ideaCardRepository } from "../infra/dexie-idea-card-repository";
import { IdeaCanvas } from "./idea-canvas";
import { SceneBuilder } from "./scene-builder";
import { UnblockPanel } from "./unblock-panel";

export function CreativityPage({ defaultTab = "unblock" }: { defaultTab?: string }) {
  const { projectId } = useSelectedProject();
  const cards =
    useLiveQuery(
      () => (projectId ? ideaCardRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const chapters =
    useLiveQuery(
      () => (projectId ? chapterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Canvas"
        count={
          cards.length > 0
            ? `${cards.length} ${cards.length === 1 ? "ideia" : "ideias"}`
            : undefined
        }
      />

      {projectId === null ? (
        <EmptyState>
          <p className="mb-4">Crie um projeto para começar a gerar ideias.</p>
          <Button asChild>
            <Link href="/projects">Ir para Projetos</Link>
          </Button>
        </EmptyState>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="unblock">Desbloqueio</TabsTrigger>
            <TabsTrigger value="builder">Construtor de cena</TabsTrigger>
            <TabsTrigger value="canvas">Canvas de ideias</TabsTrigger>
          </TabsList>
          <TabsContent value="unblock" className="pt-4">
            <UnblockPanel projectId={projectId} />
          </TabsContent>
          <TabsContent value="builder" className="pt-4">
            <SceneBuilder projectId={projectId} chapters={chapters} />
          </TabsContent>
          <TabsContent value="canvas" className="pt-4">
            <IdeaCanvas projectId={projectId} chapters={chapters} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
