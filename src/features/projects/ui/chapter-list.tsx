"use client";

import { useMemo, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/shared/lib/dates";
import type { Chapter, ChapterStatus } from "@/shared/types/database";

import { computeChapterOrder } from "@/features/plot/domain/ordering";
import { estimateReadingMinutes } from "@/features/productivity/domain/writing-log";

import {
  CHAPTER_STATUS_COLORS,
  CHAPTER_STATUS_DOT,
  CHAPTER_STATUS_LABELS,
} from "../domain/repository";
import { chapterRepository } from "../infra/dexie-chapter-repository";

interface ChapterListProps {
  chapters: Chapter[];
}

export function ChapterList({ chapters }: ChapterListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const draggedOverId = useRef<string | null>(null);

  const titlesById = useMemo(() => {
    const map = new Map<UniqueIdentifier, string>();
    for (const chapter of chapters) map.set(chapter.id, chapter.title);
    return map;
  }, [chapters]);

  const announcements = useMemo<Announcements>(() => {
    const labelFor = (id: UniqueIdentifier) =>
      titlesById.get(id) ?? "capítulo";
    return {
      onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragEnd: ({ over }) =>
        over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragCancel: () => "Arraste cancelado.",
    };
  }, [titlesById]);

  function handleDragOver(event: DragOverEvent) {
    if (event.over) draggedOverId.current = String(event.over.id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const overId = (over?.id ? String(over.id) : null) ?? draggedOverId.current;
    draggedOverId.current = null;
    if (!overId || overId === String(active.id)) return;
    const updates = computeChapterOrder(chapters, String(active.id), overId);
    if (updates.length === 0) return;
    try {
      for (const update of updates) {
        await chapterRepository.update(update.id, { order: update.order });
      }
    } catch {
      toast.error("Falha ao reordenar");
    }
  }

  if (chapters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum capítulo ainda. Crie o primeiro e comece a escrever.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragOver={handleDragOver}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      <SortableContext
        items={chapters.map((chapter) => chapter.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="grid gap-2">
          {chapters.map((chapter) => (
            <ChapterRow key={chapter.id} chapter={chapter} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function ChapterRow({ chapter }: { chapter: Chapter }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function changeStatus(status: ChapterStatus) {
    try {
      await chapterRepository.update(chapter.id, { status });
    } catch {
      toast.error("Falha ao atualizar o status");
    }
  }

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
      className={`relative select-none rounded-lg border bg-card ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${chapter.title}`}
          className="relative z-10 inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <GripVertical aria-hidden />
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={`/write/${chapter.id}`}
            className="block font-medium after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline focus-visible:outline-none"
          >
            <span className="mr-2 font-serif text-sm text-muted-foreground">
              {chapter.order}.{" "}
            </span>
            {chapter.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {chapter.wordCount.toLocaleString("pt-BR")} palavras · ~
            {estimateReadingMinutes(chapter.wordCount)} min
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs text-muted-foreground">
              atualizado {formatRelativeTime(chapter.updatedAt)}
            </span>
            <Select
              value={chapter.status}
              onValueChange={(value) =>
                void changeStatus(value as ChapterStatus)
              }
            >
              <SelectTrigger
                className={`relative z-10 h-7 w-auto gap-2 rounded-full px-2 py-0 text-xs ${CHAPTER_STATUS_COLORS[chapter.status]}`}
                aria-label={`Status de ${chapter.title}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHAPTER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${CHAPTER_STATUS_DOT[value as ChapterStatus]}`}
                    />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 shrink-0"
              aria-label={`Ações de ${chapter.title}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
