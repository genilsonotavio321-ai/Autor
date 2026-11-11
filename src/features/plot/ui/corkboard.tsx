"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Chapter, EntityId, Scene, SceneStatus } from "@/shared/types/database";

import { computeSceneMove } from "../domain/ordering";
import { SCENE_STATUS_LABELS } from "../domain/repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

import { SceneDialog } from "./scene-dialog";

interface CorkboardProps {
  projectId: EntityId;
  chapters: Chapter[];
}

const STATUS_BORDER: Record<SceneStatus, string> = {
  todo: "border-l-muted-foreground/40",
  draft: "border-l-blue-500",
  revising: "border-l-amber-500",
  done: "border-l-green-600",
};

export function Corkboard({ projectId, chapters }: CorkboardProps) {
  const liveScenes = useLiveQuery(
    () => sceneRepository.listByProject(projectId),
    [projectId],
  );
  const scenes = useMemo(() => liveScenes ?? [], [liveScenes]);
  const [filter, setFilter] = useState("");
  const [dialog, setDialog] = useState<{
    open: boolean;
    scene?: Scene | null;
    chapterId?: EntityId;
  }>({ open: false });

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  const scenesByChapter = useMemo(() => {
    const map = new Map<EntityId, Scene[]>();
    for (const chapter of chapters) map.set(chapter.id, []);
    for (const scene of scenes) {
      const list = map.get(scene.chapterId);
      if (list) list.push(scene);
    }
    return map;
  }, [chapters, scenes]);

  const visible = filter
    ? scenes.filter(
        (scene) =>
          scene.chapterId === filter ||
          chapterById.get(scene.chapterId)?.title
            .toLowerCase()
            .includes(filter.toLowerCase()),
      )
    : scenes;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Touch drags also end with a click under the finger; without this guard a
  // release would open the edit dialog and the on-screen keyboard.
  const suppressClick = useRef(false);

  function suppressNextClick() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (active.data.current?.type !== "scene") return;
    if (over.data.current?.type !== "scene") return;

    const toChapterId = over.data.current?.chapterId as EntityId;
    const target = scenesByChapter.get(toChapterId) ?? [];
    const toIndex = target.findIndex((scene) => scene.id === over.id);
    if (toIndex === -1) return;
    try {
      await sceneRepository.applyMoves(
        computeSceneMove(
          scenesByChapter,
          active.id as string,
          toChapterId,
          toIndex,
        ),
      );
    } catch {
      toast.error("Falha ao mover a cena");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56" aria-label="Filtrar por capítulo">
            <SelectValue placeholder="Todos os capítulos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os capítulos</SelectItem>
            {chapters.map((chapter) => (
              <SelectItem key={chapter.id} value={chapter.id}>
                {chapter.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => setDialog({ open: true, chapterId: chapters[0]?.id })}
          disabled={chapters.length === 0}
        >
          <Plus aria-hidden />
          Nova cena
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {scenes.length === 0
            ? "Nenhuma cena ainda. Crie capítulos no outline e adicione cenas."
            : "Nenhuma cena corresponde ao filtro."}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={() => {
            suppressClick.current = true;
          }}
          onDragCancel={suppressNextClick}
          onDragEnd={(event) => {
            suppressNextClick();
            void handleDragEnd(event);
          }}
        >
          <SortableContext
            items={visible.map((scene) => scene.id)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  chapterTitle={chapterById.get(scene.chapterId)?.title ?? "?"}
                  suppressClick={suppressClick}
                  onEdit={() => setDialog({ open: true, scene })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
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

interface SceneCardProps {
  scene: Scene;
  chapterTitle: string;
  suppressClick: RefObject<boolean>;
  onEdit: () => void;
}

function SceneCard({
  scene,
  chapterTitle,
  suppressClick,
  onEdit,
}: SceneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: scene.id,
      data: { type: "scene", chapterId: scene.chapterId },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      className={`flex flex-col rounded-lg border border-l-4 ${STATUS_BORDER[scene.status]} bg-card p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${scene.title}`}
          className="inline-flex size-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) return;
            onEdit();
          }}
          className="min-w-0 flex-1 text-left font-medium hover:underline"
        >
          {scene.title}
        </button>
      </div>
      {scene.summary ? (
        <p className="mb-3 line-clamp-4 flex-1 text-sm text-muted-foreground">
          {scene.summary}
        </p>
      ) : (
        <p className="mb-3 flex-1 text-sm italic text-muted-foreground/60">
          Sem resumo
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{chapterTitle}</Badge>
        <Badge variant="secondary">{SCENE_STATUS_LABELS[scene.status]}</Badge>
      </div>
    </li>
  );
}
