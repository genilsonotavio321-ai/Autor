"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpDown,
  FileDown,
  FileUp,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/shared/lib/dates";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
import type { EntityId, Note } from "@/shared/types/database";
import { downloadBlob, safeFilename } from "@/features/export/infra/download";
import { notesToMd, notesToTxt, plainTextToDoc } from "@/features/export/domain/plain-text";
import { ExportFormatDialog, type ExportFormat } from "@/features/export/ui/export-format-dialog";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { ProjectPicker } from "@/features/projects/ui/project-picker";

import { NOTES_SORT_LABELS, sortNotes, type NotesSort } from "../domain/sort";
import { noteRepository } from "../infra/dexie-note-repository";
import { importNotesFile } from "../infra/notes-import";
import { NoteViewDialog } from "./note-view-dialog";

const SORT_STORAGE_KEY = "autor.notes.sort";

export function NotesPage() {
  const { projectId } = useSelectedProject();
  const liveNotes =
    useLiveQuery(
      () => (projectId ? noteRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? null;
  const notes = useMemo(() => liveNotes ?? [], [liveNotes]);
  const project =
    useLiveQuery(
      () => (projectId ? projectRepository.getById(projectId) : null),
      [projectId],
    ) ?? null;

  const [sort, setSort] = useState<NotesSort>("updated");
  const [dialog, setDialog] = useState<{
    open: boolean;
    note?: Note | null;
  }>({ open: false });
  const [viewNote, setViewNote] = useState<Note | null>(null);
  const [exportTarget, setExportTarget] = useState<{
    open: boolean;
    note?: Note | null;
  }>({ open: false });
  const [clearOpen, setClearOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Deep link: /notes?note=<id> opens the note view (search result clicks).
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Set while a drag is in flight so the trailing click doesn't open the view.
  const suppressClick = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (stored && stored in NOTES_SORT_LABELS) setSort(stored as NotesSort);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SORT_STORAGE_KEY, sort);
  }, [sort]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("note");
    if (!id) return;
    setPendingId(id);
    window.history.replaceState({}, "", "/notes");
  }, []);

  useEffect(() => {
    if (!pendingId) return;
    const found = notes.find((note) => note.id === pendingId);
    if (!found) return;
    setViewNote(found);
    setPendingId(null);
  }, [pendingId, notes]);

  const sortedNotes = useMemo(() => sortNotes(notes, sort), [notes, sort]);
  const pinnedNotes = useMemo(
    () => sortedNotes.filter((note) => note.pinned),
    [sortedNotes],
  );
  const regularNotes = useMemo(
    () => sortedNotes.filter((note) => !note.pinned),
    [sortedNotes],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const titlesById = useMemo(() => {
    const map = new Map<UniqueIdentifier, string>();
    for (const note of notes) map.set(note.id, note.title);
    return map;
  }, [notes]);

  const announcements = useMemo<Announcements>(() => {
    const labelFor = (id: UniqueIdentifier) =>
      titlesById.get(id) ?? "nota";
    return {
      onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragEnd: ({ over }) =>
        over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragCancel: () => "Arraste cancelado.",
    };
  }, [titlesById]);

  function handleDragStart() {
    suppressClick.current = true;
  }

  function handleDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeNote = notes.find((note) => note.id === active.id);
    const overNote = notes.find((note) => note.id === over.id);
    // Cross-group drags are not persisted (pinned and regular keep separate
    // ordering); mirroring the no-op fallback from the chapter list.
    if (!activeNote || !overNote || activeNote.pinned !== overNote.pinned) return;
    const group = activeNote.pinned ? pinnedNotes : regularNotes;
    const ids = group.map((note) => note.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    // Persist the full visible order (pinned first, then regular).
    const fullOrder = activeNote.pinned
      ? [...reordered, ...regularNotes.map((note) => note.id)]
      : [...pinnedNotes.map((note) => note.id), ...reordered];
    if (sort !== "manual") setSort("manual");
    void noteRepository
      .applyMoves(fullOrder.map((id, order) => ({ id, order })))
      .catch(() => toast.error("Falha ao reordenar"));
  }

  function handleDragCancel() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  async function togglePin(note: Note) {
    await noteRepository.togglePinned(note.id, !note.pinned);
  }

  async function remove(note: Note) {
    await noteRepository.softDelete(note.id);
    playUiSound("delete");
    toast(`"${note.title}" movida para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void noteRepository.restore(note.id);
        },
      },
    });
  }

  async function clearNotes() {
    if (!projectId) return;
    const ids = await noteRepository.softDeleteByProject(projectId);
    if (ids.length === 0) return;
    playUiSound("delete");
    toast(
      `${ids.length} ${ids.length === 1 ? "nota movida" : "notas movidas"} para a lixeira`,
      {
        action: {
          label: "Desfazer",
          onClick: () => {
            void noteRepository.restoreMany(ids);
          },
        },
      },
    );
  }

  async function handleExport(format: ExportFormat) {
    if (!projectId) return;
    const target = exportTarget.note ? [exportTarget.note] : sortedNotes;
    const title = exportTarget.note
      ? exportTarget.note.title
      : `Notas — ${project?.title ?? "Projeto"}`;
    try {
      const filename = safeFilename(title, format);
      if (format === "txt") {
        downloadBlob(
          new Blob([notesToTxt(target)], { type: "text/plain;charset=utf-8" }),
          filename,
        );
      } else if (format === "md") {
        downloadBlob(
          new Blob([notesToMd(target)], { type: "text/markdown;charset=utf-8" }),
          filename,
        );
      } else {
        const { buildPdf } = await import("@/features/export/infra/pdf-export");
        downloadBlob(
          buildPdf({
            title,
            author: project?.author,
            cover: false,
            chapters: target.map((note) => ({
              title: note.title,
              content: plainTextToDoc(note.content),
            })),
          }),
          filename,
        );
      }
      toast.success(exportTarget.note ? "Nota baixada." : "Notas baixadas.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao exportar as notas.",
      );
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !projectId) return;
    try {
      const text = await file.text();
      const { created } = await importNotesFile(projectId, file.name, text);
      if (created === 0) {
        toast.error("Nenhuma nota encontrada no arquivo.");
        return;
      }
      toast.success(
        created === 1 ? "1 nota importada" : `${created} notas importadas`,
      );
    } catch {
      toast.error("Falha ao importar as notas.");
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Notas</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectPicker />
          <Select value={sort} onValueChange={(value) => setSort(value as NotesSort)}>
            <SelectTrigger className="w-52" aria-label="Ordenar notas">
              <ArrowUpDown aria-hidden className="size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NOTES_SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Mais opções de notas"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={notes.length === 0}
                onSelect={() => setExportTarget({ open: true })}
              >
                <FileDown aria-hidden />
                Exportar notas
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!projectId}
                onSelect={() => {
                  // Abre o seletor após o menu fechar (evita corrida de foco).
                  window.setTimeout(() => importInputRef.current?.click(), 0);
                }}
              >
                <FileUp aria-hidden />
                Importar notas
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={notes.length === 0}
                onSelect={() => setClearOpen(true)}
              >
                <Trash2 aria-hidden />
                Limpar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar as notas?</AlertDialogTitle>
                <AlertDialogDescription>
                  {notes.length}{" "}
                  {notes.length === 1
                    ? "nota será movida"
                    : "notas serão movidas"}{" "}
                  para a lixeira. Você pode restaurá-las na Lixeira.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void clearNotes()}>
                  Limpar notas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <input
            ref={importInputRef}
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => void handleImportFile(event)}
          />
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid gap-6">
            {pinnedNotes.length > 0 ? (
              <section aria-label="Notas fixadas">
                <SortableContext
                  items={pinnedNotes.map((note) => note.id)}
                  strategy={rectSortingStrategy}
                >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                    {pinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        suppressClick={suppressClick}
                        onOpenView={(target) => setViewNote(target)}
                        onTogglePin={(target) => void togglePin(target)}
                        onShare={(target) => setExportTarget({ open: true, note: target })}
                        onRemove={(target) => void remove(target)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </section>
            ) : null}
            <section aria-label="Notas">
              <SortableContext
                items={regularNotes.map((note) => note.id)}
                strategy={rectSortingStrategy}
              >
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                  {regularNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      suppressClick={suppressClick}
                      onOpenView={(target) => setViewNote(target)}
                      onTogglePin={(target) => void togglePin(target)}
                      onShare={(target) => setExportTarget({ open: true, note: target })}
                      onRemove={(target) => void remove(target)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </section>
          </div>
        </DndContext>
      )}

      <NoteViewDialog
        note={viewNote}
        onEdit={(note) => {
          setViewNote(null);
          setDialog({ open: true, note });
        }}
        onShare={(note) => {
          setViewNote(null);
          setExportTarget({ open: true, note });
        }}
        onOpenChange={(open) => {
          if (!open) setViewNote(null);
        }}
      />

      <NoteDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        note={dialog.note ?? null}
        projectId={projectId}
      />

      <ExportFormatDialog
        open={exportTarget.open}
        onOpenChange={(open) => setExportTarget((state) => ({ ...state, open }))}
        onExport={(format) => void handleExport(format)}
        title={exportTarget.note ? "Compartilhar nota" : "Exportar notas"}
        description="Escolha o formato do arquivo para baixar."
      />
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  suppressClick: React.RefObject<boolean>;
  onOpenView: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onShare: (note: Note) => void;
  onRemove: (note: Note) => void;
}

function NoteCard({
  note,
  suppressClick,
  onOpenView,
  onTogglePin,
  onShare,
  onRemove,
}: NoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function openView() {
    if (suppressClick.current) return;
    onOpenView(note);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={openView}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openView();
        }
      }}
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-4 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        isDragging ? "z-10 opacity-60" : ""
      }`}
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
