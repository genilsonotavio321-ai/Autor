"use client";

import { Pencil, Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/shared/lib/dates";
import type { Note } from "@/shared/types/database";

interface NoteViewDialogProps {
  note: Note | null;
  onEdit: (note: Note) => void;
  onShare: (note: Note) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Read-only view for a note (E3 of the review feedback): cards open here
 * instead of jumping straight into the editor.
 */
export function NoteViewDialog({ note, onEdit, onShare, onOpenChange }: NoteViewDialogProps) {
  return (
    <Dialog open={note !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (note) onShare(note);
            }}
            aria-label="Compartilhar"
            title="Compartilhar"
          >
            <Share2 aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (note) onEdit(note);
            }}
            aria-label="Editar"
            title="Editar"
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            title="Fechar"
          >
            <X aria-hidden />
          </Button>
        </div>
        <DialogHeader className="pr-24">
          <DialogTitle>{note?.title}</DialogTitle>
          <DialogDescription>
            {note ? `Atualizada ${formatRelativeTime(note.updatedAt)}` : null}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-muted/30 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {note?.content || "Esta nota está vazia."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
