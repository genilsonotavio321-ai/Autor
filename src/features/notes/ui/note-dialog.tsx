"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import type { EntityId, Note } from "@/shared/types/database";

import { noteRepository } from "../infra/dexie-note-repository";

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  projectId: EntityId | null;
}

/** Cria ou edita uma nota (título + conteúdo + imagens anexadas). */
export function NoteDialog({ open, onOpenChange, note, projectId }: NoteDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title === "Sem título" ? "" : (note?.title ?? ""));
    setContent(note?.content ?? "");
  }, [open, note]);

  async function submit() {
    if (!projectId) return;
    setSaving(true);
    try {
      if (note) {
        await noteRepository.update(note.id, {
          title: title.trim() || "Sem título",
          content,
        });
        toast.success("Nota atualizada");
      } else {
        await noteRepository.create({
          projectId,
          title: title.trim() || undefined,
          content,
        });
        toast.success("Nota criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar a nota");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>{note ? "Editar nota" : "Nova nota"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="note-title">Título</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título da nota"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note-content">Conteúdo</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              placeholder="Escreva sua nota..."
            />
          </div>
          <ImageAttachments
            entityType="note"
            entityId={note?.id}
            projectId={projectId}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
