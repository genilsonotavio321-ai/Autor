"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
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
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (note) onShare(note);
            }}
          >
            Compartilhar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (note) onEdit(note);
            }}
          >
            Editar
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
