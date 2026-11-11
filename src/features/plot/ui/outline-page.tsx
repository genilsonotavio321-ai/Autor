"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnblockPanel } from "@/features/creativity/ui/unblock-panel";
import { useUiStore } from "@/shared/store/ui-store";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";

import { OutlineTree } from "./outline-tree";
import { ScenesPanel } from "./scenes-panel";
import { StructurePanel } from "./structure-panel";

export function OutlinePage() {
  const { projectId } = useSelectedProject();
  const chapters =
    useLiveQuery(
      () => (projectId ? chapterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const [tab, setTab] = useState("structure");
  // Deep links: /outline?scene=<id> abre o SceneDialog no Roteiro;
  // /outline?beat=<id> abre o beat na Estrutura (padrão house).
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [pendingBeatId, setPendingBeatId] = useState<string | null>(null);
  const [unblockOpen, setUnblockOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get("scene");
    const beatId = params.get("beat");
    if (!sceneId && !beatId) return;
    if (sceneId) {
      setTab("outline");
      setPendingSceneId(sceneId);
    }
    if (beatId) {
      setTab("structure");
      setPendingBeatId(beatId);
    }
    window.history.replaceState({}, "", "/outline");
  }, []);

  return (
    <div className="flex flex-col gap-8">
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
          <TabsList aria-label="Seções da estrutura">
            <TabsTrigger value="structure">Estrutura</TabsTrigger>
            <TabsTrigger value="scenes">Cenas</TabsTrigger>
            <TabsTrigger value="outline">Roteiro</TabsTrigger>
          </TabsList>
          <TabsContent value="structure" className="pt-6">
            <StructurePanel
              projectId={projectId}
              chapters={chapters}
              pendingBeatId={pendingBeatId}
              onPendingBeatConsumed={() => setPendingBeatId(null)}
            />
          </TabsContent>
          <TabsContent value="scenes" className="pt-6">
            <ScenesPanel projectId={projectId} chapters={chapters} />
          </TabsContent>
          <TabsContent value="outline" className="pt-6">
            <div className="grid gap-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setUnblockOpen(true)}
                >
                  <Lightbulb aria-hidden />
                  Desbloqueio
                </Button>
              </div>
              <OutlineTree
                projectId={projectId}
                chapters={chapters}
                pendingSceneId={pendingSceneId}
                onPendingSceneConsumed={() => setPendingSceneId(null)}
              />
            </div>
            <Dialog open={unblockOpen} onOpenChange={setUnblockOpen}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Desbloqueio</DialogTitle>
                </DialogHeader>
                <UnblockPanel
                  projectId={projectId}
                  onSaved={() => {
                    // Configuração decide se guardar já fecha o popup.
                    if (useUiStore.getState().unblockCloseOnSave) {
                      setUnblockOpen(false);
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
