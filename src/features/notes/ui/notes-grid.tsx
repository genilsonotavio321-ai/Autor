"use client";

import type { RefObject } from "react";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

import type { Note } from "@/shared/types/database";

import { NoteCard } from "./note-card";

interface NotesGridProps {
  /** aria-label da seção (ex.: "Notas fixadas"). */
  label: string;
  notes: Note[];
  suppressClick: RefObject<boolean>;
  folderDropActive: boolean;
  onOpenView: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onShare: (note: Note) => void;
  onRemove: (note: Note) => void;
}

/** Grade de fichas de nota: seção + lista ordenável (dnd-kit). */
export function NotesGrid({
  label,
  notes,
  suppressClick,
  folderDropActive,
  onOpenView,
  onTogglePin,
  onShare,
  onRemove,
}: NotesGridProps) {
  return (
    <section aria-label={label}>
      <SortableContext
        items={notes.map((note) => note.id)}
        strategy={rectSortingStrategy}
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              suppressClick={suppressClick}
              folderDropActive={folderDropActive}
              onOpenView={onOpenView}
              onTogglePin={onTogglePin}
              onShare={onShare}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}
