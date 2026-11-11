"use client";

import { useMemo, useState } from "react";
import { Columns3, Hammer, List, Plus } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SceneBuilder } from "@/features/creativity/ui/scene-builder";
import type { Chapter, EntityId, Scene } from "@/shared/types/database";

import { SCENE_STATUS_LABELS } from "../domain/repository";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

import { Kanban } from "./kanban";
import { SceneDialog } from "./scene-dialog";

type SceneView = "list" | "kanban";

const VIEWS: { id: SceneView; label: string; icon: typeof List }[] = [
  { id: "list", label: "Lista", icon: List },
  { id: "kanban", label: "Kanban", icon: Columns3 },
];

interface ScenesPanelProps {
  projectId: EntityId;
  chapters: Chapter[];
}

/** Aba Cenas: lista e kanban como visões da mesma coleção. */
export function ScenesPanel({ projectId, chapters }: ScenesPanelProps) {
  const [view, setView] = useState<SceneView>("list");
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Visualização das cenas"
          className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
        >
          {VIEWS.map((option) => {
            const Icon = option.icon;
            const active = view === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={active ? "secondary" : "ghost"}
                aria-pressed={active}
                onClick={() => setView(option.id)}
                className="gap-2"
              >
                <Icon aria-hidden className="size-4" />
                {option.label}
              </Button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={() => setBuilderOpen(true)}>
          <Hammer aria-hidden className="size-4" />
          Construtor de cena
        </Button>
      </div>

      {view === "list" ? (
        <SceneList projectId={projectId} chapters={chapters} />
      ) : (
        <Kanban projectId={projectId} chapters={chapters} />
      )}

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Construtor de cena</DialogTitle>
          </DialogHeader>
          <SceneBuilder projectId={projectId} chapters={chapters} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SceneList({ projectId, chapters }: ScenesPanelProps) {
  const scenes =
    useLiveQuery(() => sceneRepository.listByProject(projectId), [projectId]) ??
    [];
  const beats =
    useLiveQuery(() => plotBeatRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const [dialog, setDialog] = useState<{
    open: boolean;
    scene?: Scene | null;
    chapterId?: EntityId;
  }>({ open: false });

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );
  const beatById = useMemo(
    () => new Map(beats.map((beat) => [beat.id, beat])),
    [beats],
  );

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() =>
            setDialog({ open: true, chapterId: chapters[0]?.id })
          }
          disabled={chapters.length === 0}
        >
          <Plus aria-hidden />
          Nova cena
        </Button>
      </div>

      {scenes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma cena ainda. Crie capítulos no Roteiro e adicione cenas.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {scenes.map((scene) => {
            const beat = scene.beatId ? beatById.get(scene.beatId) : undefined;
            return (
              <li
                key={scene.id}
                className="flex flex-wrap items-center gap-2 p-3"
              >
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, scene })}
                  className="min-w-0 flex-1 basis-48 truncate text-left font-medium hover:underline"
                >
                  {scene.title}
                </button>
                {beat ? (
                  <Badge variant="outline" className="max-w-48 truncate">
                    {beat.title}
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  {chapterById.get(scene.chapterId)?.title ?? "?"}
                </Badge>
                <Badge variant="secondary">
                  {SCENE_STATUS_LABELS[scene.status]}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      <SceneDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        scene={dialog.scene}
        defaultChapterId={dialog.chapterId}
        chapters={chapters}
      />
    </div>
  );
}
