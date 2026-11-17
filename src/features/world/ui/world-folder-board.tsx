"use client";

import {
  DndContext,
  closestCenter,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import { EmptyState } from "@/components/layout/empty-state";
import { FolderBackBar } from "@/features/folders/ui/folder-back-bar";
import type { useFolderDragHint } from "@/features/folders/ui/drag-hint";
import type { EntityId, Folder } from "@/shared/types/database";

type BoardHint = ReturnType<typeof useFolderDragHint>;

/**
 * Quadro de uma aba do Mundo: pastas + fichas arrastáveis. As três abas
 * (locais, lore e objetos) usam o mesmo esqueleto, só mudando as listas.
 */
export function WorldFolderBoard({
  sensors,
  announcements,
  hint,
  viewIds,
  currentFolder,
  onExitFolder,
  emptyFolderHint,
  onDragStart,
  onDragEnd,
  onDragCancel,
  children,
}: {
  sensors: Parameters<typeof DndContext>[0]["sensors"];
  announcements: Announcements;
  hint: BoardHint;
  viewIds: EntityId[];
  currentFolder: Folder | null;
  onExitFolder: () => void;
  emptyFolderHint?: string;
  onDragStart: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={(event) => {
        onDragStart();
        hint.onDragStart(event);
      }}
      onDragMove={hint.onDragMove}
      onDragOver={hint.onDragOver}
      onDragEnd={(event) => {
        hint.onDragEnd();
        onDragEnd(event);
      }}
      onDragCancel={() => {
        hint.onDragCancel();
        onDragCancel();
      }}
    >
      {currentFolder ? (
        <FolderBackBar title={currentFolder.name} onBack={onExitFolder} />
      ) : null}
      <SortableContext items={viewIds} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
      {emptyFolderHint ? <EmptyState hint={emptyFolderHint} /> : null}
      {hint.hint}
    </DndContext>
  );
}
