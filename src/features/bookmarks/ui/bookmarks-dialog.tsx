"use client";

import { Bookmark as BookmarkIcon, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Bookmark } from "@/shared/types/database";

interface BookmarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: Bookmark[];
  /** Tamanho do documento, para mostrar a posição relativa (opcional). */
  docSize?: number | null;
  onAdd: () => void;
  onJump: (bookmark: Bookmark) => void;
  onRemove: (bookmark: Bookmark) => void;
}

function positionLabel(bookmark: Bookmark, docSize?: number | null): string {
  if (!docSize || docSize <= 0) return "Marcador";
  const percent = Math.min(
    100,
    Math.max(1, Math.round((bookmark.position / docSize) * 100)),
  );
  return `A ${percent}% do capítulo`;
}

/** Lista de marcadores: adicionar no ponto atual, pular e remover. */
export function BookmarksDialog({
  open,
  onOpenChange,
  bookmarks,
  docSize,
  onAdd,
  onJump,
  onRemove,
}: BookmarksDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcadores</DialogTitle>
          <DialogDescription>
            Pontos salvos neste capítulo para voltar depois.
          </DialogDescription>
        </DialogHeader>

        {bookmarks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum marcador ainda. Salve o ponto em que você está para voltar
            direto a ele.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {bookmarks.map((bookmark, index) => (
              <li key={bookmark.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onJump(bookmark)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2.5 text-left text-sm hover:bg-accent/60"
                  aria-label={`Ir para o marcador ${index + 1}`}
                >
                  <BookmarkIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{bookmark.excerpt}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {positionLabel(bookmark, docSize)}
                    </span>
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-full text-muted-foreground"
                  aria-label={`Remover marcador ${index + 1}`}
                  onClick={() => onRemove(bookmark)}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button type="button" variant="outline" className="gap-2" onClick={onAdd}>
          <Plus aria-hidden />
          Adicionar marcador neste ponto
        </Button>
      </DialogContent>
    </Dialog>
  );
}
