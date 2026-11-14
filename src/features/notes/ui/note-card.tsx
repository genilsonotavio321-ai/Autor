"use client";

import type { RefObject } from "react";
import { Pin, PinOff, Share2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCardSortable } from "@/shared/lib/sortable";
import { formatRelativeTime } from "@/shared/lib/dates";
import type { Note } from "@/shared/types/database";

interface NoteCardProps {
  note: Note;
  /** Set enquanto arrasta: o clique do fim do arraste não abre a visualização. */
  suppressClick: RefObject<boolean>;
  /** A drop no centro deste card criaria uma pasta (ring + aviso visível). */
  folderDropActive: boolean;
  onOpenView: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onShare: (note: Note) => void;
  onRemove: (note: Note) => void;
}

/** Ficha de nota: abre a visualização ao clicar, arrasta para reordenar. */
export function NoteCard({
  note,
  suppressClick,
  folderDropActive,
  onOpenView,
  onTogglePin,
  onShare,
  onRemove,
}: NoteCardProps) {
  const { setNodeRef, dragProps, style, isDragging, isOver } =
    useCardSortable(note.id);

  function openView() {
    if (suppressClick.current) return;
    onOpenView(note);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      {...dragProps}
      onClick={openView}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Espaço fica com o dnd-kit: é a tecla que "pega" o card para
        // reordenar por teclado. Abrir a visualização é o Enter.
        if (event.key === "Enter") {
          event.preventDefault();
          openView();
        }
      }}
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-4 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        isDragging ? "z-10 opacity-60" : ""
      } ${isOver && folderDropActive ? "ring-2 ring-primary bg-primary/5" : ""}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <button
          type="button"
          aria-label={note.pinned ? `Desafixar ${note.title}` : `Fixar ${note.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(note);
          }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {note.pinned ? (
            <Pin aria-hidden className="text-primary" />
          ) : (
            <PinOff aria-hidden />
          )}
        </button>
        <span className="min-w-0 flex-1 font-medium">{note.title}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Compartilhar ${note.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onShare(note);
          }}
        >
          <Share2 aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${note.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(note);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {note.content ? (
        <p className="mb-3 line-clamp-6 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {note.content}
        </p>
      ) : (
        <p className="mb-3 flex-1 text-sm italic text-muted-foreground/60">
          Sem conteúdo
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          atualizada {formatRelativeTime(note.updatedAt)}
        </span>
        {note.pinned ? <Badge>Fixada</Badge> : null}
      </div>
    </li>
  );
}
