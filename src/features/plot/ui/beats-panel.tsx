"use client";

import { useRef, useState, type RefObject } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { applyBeatTemplate } from "@/features/plot/application/plot-service";
import { Button } from "@/components/ui/button";
import { handleDialogEnter } from "@/shared/lib/keyboard";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Chapter, EntityId, PlotBeat, PlotStructure } from "@/shared/types/database";

import {
  BEAT_TEMPLATES,
  getBeatTemplate,
} from "../domain/beat-templates";
import { renumber } from "../domain/ordering";
import { PLOT_STRUCTURE_LABELS } from "../domain/repository";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";

interface BeatsPanelProps {
  projectId: EntityId;
  chapters: Chapter[];
}

const NO_LINK = "__none__";

export function BeatsPanel({ projectId, chapters }: BeatsPanelProps) {
  const beats =
    useLiveQuery(() => plotBeatRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const [structure, setStructure] = useState<PlotStructure>("three_acts");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<PlotBeat | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function requestApply() {
    if (beats.length > 0) setConfirmOpen(true);
    else void apply();
  }

  async function apply() {
    try {
      const result = await applyBeatTemplate(projectId, structure, {
        replaceExisting: beats.length > 0,
      });
      toast.success(
        `${result.created} beats aplicados${result.replaced > 0 ? ` (${result.replaced} anteriores substituídos)` : ""}`,
      );
    } catch {
      toast.error("Falha ao aplicar o template de beats");
    } finally {
      setConfirmOpen(false);
    }
  }

  // Touch drags also end with a click under the finger; without this guard a
  // release would open the edit dialog and the on-screen keyboard.
  const suppressClick = useRef(false);

  function suppressNextClick() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = beats.findIndex((beat) => beat.id === active.id);
    const to = beats.findIndex((beat) => beat.id === over.id);
    if (from === -1 || to === -1) return;
    const reordered = [...beats];
    const [moved] = reordered.splice(from, 1);
    if (!moved) return;
    reordered.splice(to, 0, moved);
    try {
      await plotBeatRepository.applyMoves(renumber(reordered));
    } catch {
      toast.error("Falha ao reordenar os beats");
    }
  }

  async function linkChapter(beat: PlotBeat, value: string) {
    await plotBeatRepository.update(beat.id, {
      linkedChapterId: value === NO_LINK ? null : value,
    });
  }

  async function remove(beat: PlotBeat) {
    await plotBeatRepository.softDelete(beat.id);
    toast(`"${beat.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void plotBeatRepository.restore(beat.id);
        },
      },
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-2">
          <Label>Estrutura</Label>
          <Select
            value={structure}
            onValueChange={(value) => setStructure(value as PlotStructure)}
          >
            <SelectTrigger className="w-56" aria-label="Estrutura de beats">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BEAT_TEMPLATES.map((template) => (
                <SelectItem
                  key={template.structure}
                  value={template.structure}
                >
                  {PLOT_STRUCTURE_LABELS[template.structure]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={requestApply}>Aplicar template</Button>
        <p className="text-sm text-muted-foreground">
          {getBeatTemplate(structure)?.description}
        </p>
      </div>

      {beats.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum beat ainda. Aplique um template para começar a planear o enredo.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={() => {
            suppressClick.current = true;
          }}
          onDragCancel={suppressNextClick}
          onDragEnd={(event) => {
            suppressNextClick();
            void handleDragEnd(event);
          }}
        >
          <SortableContext
            items={beats.map((beat) => beat.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y rounded-lg border">
              {beats.map((beat) => (
                <BeatRow
                  key={beat.id}
                  beat={beat}
                  chapters={chapters}
                  suppressClick={suppressClick}
                  onEdit={() => {
                    if (suppressClick.current) return;
                    setEditing(beat);
                    setEditOpen(true);
                  }}
                  onLinkChapter={(value) => void linkChapter(beat, value)}
                  onRemove={() => void remove(beat)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir beats existentes?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto já tem {beats.length} beats. Aplicar o template{" "}
              {PLOT_STRUCTURE_LABELS[structure]} irá remover os atuais e criar a
              nova lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void apply()}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BeatEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        beat={editing}
      />
    </div>
  );
}

interface BeatRowProps {
  beat: PlotBeat;
  chapters: Chapter[];
  suppressClick: RefObject<boolean>;
  onEdit: () => void;
  onLinkChapter: (value: string) => void;
  onRemove: () => void;
}

function BeatRow({
  beat,
  chapters,
  suppressClick,
  onEdit,
  onLinkChapter,
  onRemove,
}: BeatRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: beat.id, data: { type: "beat" } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${beat.title}`}
        className="inline-flex size-8 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GripVertical aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) return;
            onEdit();
          }}
          className="block truncate text-left font-medium hover:underline"
        >
          {beat.title}
        </button>
        {beat.description ? (
          <p className="truncate text-xs text-muted-foreground">
            {beat.description}
          </p>
        ) : null}
      </div>
      <Select
        value={beat.linkedChapterId ?? NO_LINK}
        onValueChange={onLinkChapter}
      >
        <SelectTrigger
          className="hidden h-8 w-44 md:flex"
          aria-label={`Capítulo vinculado a ${beat.title}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_LINK}>Sem capítulo</SelectItem>
          {chapters.map((chapter) => (
            <SelectItem key={chapter.id} value={chapter.id}>
              {chapter.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        aria-label={`Excluir ${beat.title}`}
        onClick={onRemove}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 aria-hidden />
      </button>
    </li>
  );
}

interface BeatEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beat: PlotBeat | null;
}

function BeatEditDialog({ open, onOpenChange, beat }: BeatEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Sync fields when a different beat is opened.
  const [lastId, setLastId] = useState<string | null>(null);
  if (open && beat && beat.id !== lastId) {
    setLastId(beat.id);
    setTitle(beat.title);
    setDescription(beat.description ?? "");
  }
  if (!open && lastId !== null) setLastId(null);

  async function save() {
    if (!beat) return;
    try {
      await plotBeatRepository.update(beat.id, {
        title: title.trim() || beat.title,
        description,
      });
      toast.success("Beat atualizado");
      onOpenChange(false);
    } catch {
      toast.error("Falha ao atualizar o beat");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => handleDialogEnter(event, () => void save())}
      >
        <DialogHeader>
          <DialogTitle>Editar beat</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="beat-title">Título</Label>
            <Input
              id="beat-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="beat-description">Descrição</Label>
            <Textarea
              id="beat-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
