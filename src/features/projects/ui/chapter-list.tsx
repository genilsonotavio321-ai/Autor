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
        <ul className="divide-y rounded-lg border">
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
      className={`flex select-none items-center gap-3 bg-card p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${chapter.title}`}
        className="inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <GripVertical aria-hidden />
      </button>
      <span
        aria-hidden
        className="w-6 shrink-0 text-center font-serif text-sm text-muted-foreground"
      >
        {chapter.order}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/write/${chapter.id}`}
          className="block truncate font-medium hover:underline"
        >
          {chapter.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {chapter.wordCount.toLocaleString("pt-BR")} palavras ·
          atualizado {formatRelativeTime(chapter.updatedAt)}
        </p>
      </div>
      <Select
        value={chapter.status}
        onValueChange={(value) => void changeStatus(value as ChapterStatus)}
      >
        <SelectTrigger
          className={`h-8 w-36 gap-2 ${CHAPTER_STATUS_COLORS[chapter.status]}`}
          aria-label={`Status de ${chapter.title}`}
        >
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full ${CHAPTER_STATUS_DOT[chapter.status]}`}
          />
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
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
    </li>
  );
}
