"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { Chapter, EntityId, Scene, SceneStatus } from "@/shared/types/database";

import { SCENE_STATUSES, SCENE_STATUS_LABELS } from "../domain/repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

import { SceneDialog } from "./scene-dialog";

interface KanbanProps {
  projectId: EntityId;
  chapters: Chapter[];
}

export function Kanban({ projectId, chapters }: KanbanProps) {
  const scenes =
    useLiveQuery(() => sceneRepository.listByProject(projectId), [projectId]) ??
    [];
  const [dialog, setDialog] = useState<{ open: boolean; scene?: Scene | null }>({
    open: false,
  });

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

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
    if (active.data.current?.type !== "card") return;

    const targetStatus = over.data.current?.status as
      | SceneStatus
      | undefined;
    if (!targetStatus) return;

    const scene = scenes.find((item) => item.id === active.id);
    if (!scene || scene.status === targetStatus) return;

    try {
      await sceneRepository.update(scene.id, { status: targetStatus });
      toast.success(
        `"${scene.title}" → ${SCENE_STATUS_LABELS[targetStatus]}`,
      );
    } catch {
      toast.error("Falha ao mover a cena");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        suppressClick.current = true;
      }}
      onDragCancel={suppressNextClick}
      onDragEnd={(event) => {
        suppressNextClick();
        void handleDragEnd(event);
      }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SCENE_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            scenes={scenes.filter((scene) => scene.status === status)}
            chapterTitle={(scene) =>
              chapterById.get(scene.chapterId)?.title ?? "?"
            }
            suppressClick={suppressClick}
            onEdit={(scene) => setDialog({ open: true, scene })}
          />
        ))}
      </div>
      <SceneDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        scene={dialog.scene}
        chapters={chapters}
      />
    </DndContext>
  );
}

interface KanbanColumnProps {
  status: SceneStatus;
  scenes: Scene[];
  chapterTitle: (scene: Scene) => string;
  suppressClick: RefObject<boolean>;
  onEdit: (scene: Scene) => void;
}

function KanbanColumn({
  status,
  scenes,
  chapterTitle,
  suppressClick,
  onEdit,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={`Cenas: ${SCENE_STATUS_LABELS[status]}`}
      className={`flex min-h-40 flex-col rounded-lg border bg-muted/30 p-2 ${isOver ? "ring-2 ring-ring" : ""}`}
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">{SCENE_STATUS_LABELS[status]}</h3>
        <Badge variant="secondary">{scenes.length}</Badge>
      </header>
      <SortableContext
        items={scenes.map((scene) => scene.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="grid gap-2">
          {scenes.map((scene) => (
            <KanbanCard
              key={scene.id}
              scene={scene}
              chapterTitle={chapterTitle(scene)}
              suppressClick={suppressClick}
              onEdit={() => onEdit(scene)}
            />
          ))}
        </ul>
      </SortableContext>
      {scenes.length === 0 ? (
        <p className="p-2 text-center text-xs text-muted-foreground">
          Arraste uma cena para cá
        </p>
      ) : null}
    </section>
  );
}

interface KanbanCardProps {
  scene: Scene;
  chapterTitle: string;
  suppressClick: RefObject<boolean>;
  onEdit: () => void;
}

function KanbanCard({
  scene,
  chapterTitle,
  suppressClick,
  onEdit,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: scene.id,
      data: { type: "card", status: scene.status },
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
      className={`rounded-md border bg-card p-2 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover ${scene.title}`}
          className="inline-flex size-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{scene.title}</p>
          <p className="truncate text-xs text-muted-foreground">{chapterTitle}</p>
        </div>
        <button
          type="button"
          aria-label={`Editar ${scene.title}`}
          onClick={() => {
            if (suppressClick.current) return;
            onEdit();
          }}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil aria-hidden />
        </button>
      </div>
    </li>
  );
}
