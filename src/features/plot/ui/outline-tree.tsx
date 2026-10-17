"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import type { Chapter, EntityId, Scene } from "@/shared/types/database";

import { computeChapterOrder, computeSceneMove } from "../domain/ordering";
import { SCENE_STATUS_LABELS } from "../domain/repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

import { SceneDialog } from "./scene-dialog";

interface OutlineTreeProps {
  projectId: EntityId;
  chapters: Chapter[];
}

function dragHandleProps(
  attributes: ReturnType<typeof useSortable>["attributes"],
  listeners: ReturnType<typeof useSortable>["listeners"],
  label: string,
) {
  return {
    ...attributes,
    ...listeners,
    "aria-label": label,
    className:
      "inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  } as const;
}

export function OutlineTree({ projectId, chapters }: OutlineTreeProps) {
  const liveScenes = useLiveQuery(
    () => sceneRepository.listByProject(projectId),
    [projectId],
  );
  const scenes = useMemo(() => liveScenes ?? [], [liveScenes]);
  const [dialog, setDialog] = useState<{
    open: boolean;
    scene?: Scene | null;
    chapterId?: EntityId;
  }>({ open: false });

  const scenesByChapter = useMemo(() => {
    const map = new Map<EntityId, Scene[]>();
    for (const chapter of chapters) map.set(chapter.id, []);
    for (const scene of scenes) {
      const list = map.get(scene.chapterId);
      if (list) list.push(scene);
    }
    return map;
  }, [chapters, scenes]);

  const titlesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chapters) map.set(chapter.id, chapter.title);
    for (const scene of scenes) map.set(scene.id, scene.title);
    return map;
  }, [chapters, scenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const draggedOverId = useRef<EntityId | null>(null);

  // Track the current collision target on every move: keyboard drops can
  // fire `onDragEnd` with a null `over`, so we fall back to this.
  function handleDragOver(event: DragOverEvent) {
    if (event.over) draggedOverId.current = event.over.id as EntityId;
  }

  // Announce drags by title (not internal ids) so screen readers — and
  // tests — can follow keyboard reordering.
  const announcements = useMemo<Announcements>(() => {
    const labelFor = (id: UniqueIdentifier) =>
      titlesById.get(String(id)) ?? "item";
    return {
      onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragEnd: ({ over }) =>
        over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragCancel: () => "Arraste cancelado.",
    };
  }, [titlesById]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    const activeType = active.data.current?.type as string | undefined;
    const activeId = active.id as string;

    const fallbackOverId = draggedOverId.current;
    draggedOverId.current = null;

    try {
      if (activeType === "chapter") {
        // Keyboard drops can report a null `over`; fall back to the last
        // known collision target and resolve scenes to their chapter.
        const overRawId = (over?.id as EntityId | undefined) ?? fallbackOverId;
        if (!overRawId || overRawId === activeId) return;
        const overScene = scenes.find((scene) => scene.id === overRawId);
        const overChapterId = overScene ? overScene.chapterId : overRawId;
        if (overChapterId === activeId) return;
        const updates = computeChapterOrder(chapters, activeId, overChapterId);
        for (const update of updates) {
          await chapterRepository.update(update.id, { order: update.order });
        }
      } else if (activeType === "scene" && over) {
        const overType = over.data.current?.type as string | undefined;
        const toChapterId =
          overType === "scene"
            ? (over.data.current?.chapterId as EntityId)
            : (over.id as string);
        const target = scenesByChapter.get(toChapterId) ?? [];
        const toIndex =
          overType === "scene"
            ? target.findIndex((scene) => scene.id === over.id)
            : target.length;
        const updates = computeSceneMove(
          scenesByChapter,
          active.id as string,
          toChapterId,
          Math.max(0, toIndex),
        );
        await sceneRepository.applyMoves(updates);
      }
    } catch {
      toast.error("Falha ao reordenar");
    }
  }

  async function addChapter() {
    const chapter = await chapterRepository.create({ projectId });
    toast.success(`"${chapter.title}" criado`);
  }

  async function addScene(chapterId: EntityId) {
    const scene = await sceneRepository.create({ chapterId });
    toast.success(`"${scene.title}" criada`);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragOver={handleDragOver}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <SortableContext
          items={chapters.map((chapter) => chapter.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="grid gap-3">
            {chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                scenes={scenesByChapter.get(chapter.id) ?? []}
                onAddScene={() => void addScene(chapter.id)}
                onEditScene={(scene) =>
                  setDialog({ open: true, scene, chapterId: chapter.id })
                }
              />
            ))}
          </ul>
        </SortableContext>
        {chapters.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum capítulo. Adicione o primeiro para esboçar a história.
          </div>
        ) : null}
      </DndContext>

      <Button variant="outline" className="mt-4" onClick={() => void addChapter()}>
        <Plus aria-hidden />
        Adicionar capítulo
      </Button>

      <SceneDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        scene={dialog.scene}
        defaultChapterId={dialog.chapterId}
        chapters={chapters}
      />
    </>
  );
}

interface ChapterRowProps {
  chapter: Chapter;
  scenes: Scene[];
  onAddScene: () => void;
  onEditScene: (scene: Scene) => void;
}

function ChapterRow({
  chapter,
  scenes,
  onAddScene,
  onEditScene,
}: ChapterRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: chapter.id,
      data: { type: "chapter" },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function remove() {
    await chapterRepository.softDelete(chapter.id);
    toast(`"${chapter.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void chapterRepository.restore(chapter.id);
        },
      },
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 p-3">
        <button type="button" {...dragHandleProps(attributes, listeners, `Reordenar ${chapter.title}`)}>
          <GripVertical aria-hidden />
        </button>
        <span aria-hidden className="font-serif text-sm text-muted-foreground">
          {chapter.order}
        </span>
        <Link
          href={`/write/${chapter.id}`}
          className="min-w-0 flex-1 truncate font-medium hover:underline"
        >
          {chapter.title}
        </Link>
        <Badge variant="outline" className="hidden sm:inline-flex">
          {chapter.wordCount.toLocaleString("pt-BR")} palavras
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Adicionar cena em ${chapter.title}`}
          onClick={onAddScene}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${chapter.title}`}
          onClick={() => void remove()}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <SortableContext
        items={scenes.map((scene) => scene.id)}
        strategy={verticalListSortingStrategy}
      >
        {scenes.length > 0 ? (
          <ul className="border-t">
            {scenes.map((scene) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                onEdit={() => onEditScene(scene)}
              />
            ))}
          </ul>
        ) : null}
      </SortableContext>
    </li>
  );
}

interface SceneRowProps {
  scene: Scene;
  onEdit: () => void;
}

function SceneRow({ scene, onEdit }: SceneRowProps) {
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
      className={`flex items-center gap-2 px-3 py-2 pl-10 ${isDragging ? "opacity-60" : ""}`}
    >
      <button type="button" {...dragHandleProps(attributes, listeners, `Reordenar ${scene.title}`)}>
        <GripVertical aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">
        {scene.title}
        {scene.summary ? (
          <span className="ml-2 text-muted-foreground">— {scene.summary}</span>
        ) : null}
      </span>
      <Badge variant="secondary" className="hidden md:inline-flex">
        {SCENE_STATUS_LABELS[scene.status]}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${scene.title}`}
        onClick={onEdit}
      >
        <Pencil aria-hidden />
      </Button>
    </li>
  );
}
