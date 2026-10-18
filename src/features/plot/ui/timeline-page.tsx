"use client";

import { useState } from "react";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { handleDialogEnter } from "@/shared/lib/keyboard";
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
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import type { Chapter, EntityId, TimelineEvent } from "@/shared/types/database";

import { timelineEventRepository } from "../infra/dexie-timeline-event-repository";

const NO_LINK = "__none__";

export function TimelinePage() {
  const { projectId } = useSelectedProject();
  const chapters =
    useLiveQuery(
      () => (projectId ? chapterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const events =
    useLiveQuery(
      () => (projectId ? timelineEventRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const [chapterFilter, setChapterFilter] = useState("");
  const [dialog, setDialog] = useState<{
    open: boolean;
    event?: TimelineEvent | null;
  }>({ open: false });

  const chapterById = new Map(
    chapters.map((chapter) => [chapter.id, chapter] as const),
  );

  const visible = chapterFilter
    ? events.filter((event) => event.linkedChapterId === chapterFilter)
    : events;

  async function remove(event: TimelineEvent) {
    await timelineEventRepository.softDelete(event.id);
    toast(`"${event.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void timelineEventRepository.restore(event.id);
        },
      },
    });
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Linha do tempo</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectPicker />
          <Button
            onClick={() => setDialog({ open: true })}
            disabled={!projectId}
          >
            <Plus aria-hidden />
            Novo evento
          </Button>
        </div>
      </header>

      {projectId === null ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Crie um projeto para montar a linha do tempo.
          </p>
        </div>
      ) : (
        <>
          {chapters.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select value={chapterFilter} onValueChange={setChapterFilter}>
                <SelectTrigger
                  className="w-64"
                  aria-label="Filtrar eventos por capítulo"
                >
                  <SelectValue placeholder="Todos os capítulos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os capítulos</SelectItem>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhum evento ainda. Registre marcos da história em ordem
              cronológica.
            </div>
          ) : (
            <ol className="relative grid gap-3 border-l pl-6">
              {visible.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[1.95rem] top-2 size-3 rounded-full border-2 border-background bg-primary"
                  />
                  <article className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <Badge variant="outline" className="font-mono">
                        {event.date}
                      </Badge>
                      <h2 className="min-w-0 flex-1 font-medium">{event.title}</h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${event.title}`}
                        onClick={() => setDialog({ open: true, event })}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${event.title}`}
                        onClick={() => void remove(event)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                    {event.linkedChapterId ? (
                      <Link
                        href={`/write/${event.linkedChapterId}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      >
                        <CalendarRange aria-hidden className="size-3" />
                        {chapterById.get(event.linkedChapterId)?.title ??
                          "Capítulo"}
                      </Link>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <EventDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        event={dialog.event ?? null}
        projectId={projectId}
        chapters={chapters}
      />
    </div>
  );
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEvent | null;
  projectId: EntityId | null;
  chapters: Chapter[];
}

function EventDialog({
  open,
  onOpenChange,
  event,
  projectId,
  chapters,
}: EventDialogProps) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chapterId, setChapterId] = useState(NO_LINK);
  const [lastId, setLastId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Stable dialog key: "new" for creation, the event id when editing.
  const editKey = event?.id ?? "new";
  if (open && editKey !== lastId) {
    setLastId(editKey);
    setDate(event?.date ?? "");
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setChapterId(event?.linkedChapterId ?? NO_LINK);
  }
  if (!open && lastId !== null) setLastId(null);

  async function submit() {
    if (!projectId || !title.trim() || !date.trim()) return;
    setSaving(true);
    try {
      const linked = chapterId === NO_LINK ? null : chapterId;
      if (event) {
        await timelineEventRepository.update(event.id, {
          date,
          title,
          description,
          linkedChapterId: linked,
        });
        toast.success("Evento atualizado");
      } else {
        await timelineEventRepository.create({
          projectId,
          date,
          title,
          description,
          linkedChapterId: linked ?? undefined,
        });
        toast.success("Evento criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar o evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="event-date">Data</Label>
            <Input
              id="event-date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              placeholder="1889, 1889-05 ou 1889-05-12"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="O que acontece?"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-description">Descrição</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Capítulo vinculado</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger aria-label="Capítulo do evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>Nenhum</SelectItem>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !title.trim() || !date.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
