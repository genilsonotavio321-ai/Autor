"use client";

import { useEffect, useState } from "react";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { formatRelativeTime } from "@/shared/lib/dates";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import type { EntityId, Note } from "@/shared/types/database";

import { noteRepository } from "../infra/dexie-note-repository";

export function NotesPage() {
  const { projectId } = useSelectedProject();
  const notes =
    useLiveQuery(
      () => (projectId ? noteRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const [dialog, setDialog] = useState<{
    open: boolean;
    note?: Note | null;
  }>({ open: false });

  async function togglePin(note: Note) {
    await noteRepository.togglePinned(note.id, !note.pinned);
  }

  async function remove(note: Note) {
    await noteRepository.softDelete(note.id);
    toast(`"${note.title}" movida para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void noteRepository.restore(note.id);
        },
      },
    });
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Notas</h1>
        <div className="flex items-center gap-2">
          <ProjectPicker />
          <Button onClick={() => setDialog({ open: true })} disabled={!projectId}>
            <Plus aria-hidden />
            Nova nota
          </Button>
        </div>
      </header>

      {projectId === null ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Crie um projeto para anotar ideias e lembretes.
          </p>
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma nota ainda. Use notas para ideias soltas, pesquisas e
          lembretes.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex flex-col rounded-lg border bg-card p-4"
            >
              <div className="mb-2 flex items-start gap-2">
                <button
                  type="button"
                  aria-label={note.pinned ? `Desafixar ${note.title}` : `Fixar ${note.title}`}
                  onClick={() => void togglePin(note)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {note.pinned ? (
                    <Pin aria-hidden className="text-primary" />
                  ) : (
                    <PinOff aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, note })}
                  className="min-w-0 flex-1 text-left font-medium hover:underline"
                >
                  {note.title}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${note.title}`}
                  onClick={() => void remove(note)}
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
          ))}
        </ul>
      )}

      <NoteDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        note={dialog.note ?? null}
        projectId={projectId}
      />
    </div>
  );
}

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  projectId: EntityId | null;
}

function NoteDialog({ open, onOpenChange, note, projectId }: NoteDialogProps) {
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
      <DialogContent className="sm:max-w-xl">
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
