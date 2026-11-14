"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Layers, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { attachmentRepository } from "@/features/attachments/infra/dexie-attachment-repository";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import type {
  EntityId,
  LoreEntry,
  NarrativeArc,
  StoryItem,
  TimelineEvent,
} from "@/shared/types/database";

import { findContinuityIssues } from "../domain/continuity";
import { narrativeArcRepository } from "../infra/dexie-narrative-arc-repository";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";
import { sceneRepository } from "../infra/dexie-scene-repository";
import { timelineEventRepository } from "../infra/dexie-timeline-event-repository";
import { ContinuityPanel } from "./continuity-panel";
import { EventDialog } from "./event-dialog";
import { NarrativeArcDialog } from "./narrative-arc-dialog";
import { NarrativeTimeline } from "./narrative-timeline";

const EMPTY_EVENTS: TimelineEvent[] = [];
const EMPTY_LORE_ENTRIES: LoreEntry[] = [];

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
    ) ?? EMPTY_EVENTS;
  const characters =
    useLiveQuery(
      () => (projectId ? characterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const locations =
    useLiveQuery(
      () => (projectId ? locationRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const scenes =
    useLiveQuery(
      () => (projectId ? sceneRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const arcs =
    useLiveQuery(
      () => (projectId ? narrativeArcRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const beats =
    useLiveQuery(
      () => (projectId ? plotBeatRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const loreEntries =
    useLiveQuery(
      () => (projectId ? loreEntryRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? EMPTY_LORE_ENTRIES;
  const items = useMemo<StoryItem[]>(
    () =>
      loreEntries
        .filter((entry) => entry.isTrackableItem)
        .map((entry) => ({
          id: entry.id,
          name: entry.title,
          initialOwnerId: entry.initialOwnerId,
        })),
    [loreEntries],
  );
  const issues = useMemo(
    () => findContinuityIssues(events),
    [events],
  );
  const [activeTab, setActiveTab] = useState("events");
  const [chapterFilter, setChapterFilter] = useState("");
  const [dialog, setDialog] = useState<{
    open: boolean;
    event?: TimelineEvent | null;
  }>({ open: false });
  const [arcDialog, setArcDialog] = useState<{
    open: boolean;
    arc?: NarrativeArc | null;
  }>({ open: false });

  const liveAttachments = useLiveQuery(
    () =>
      projectId ? attachmentRepository.listByProject(projectId) : [],
    [projectId],
  );
  // First image of each event, for the inline card thumbnail.
  const firstEventImage = useMemo(() => {
    const map = new Map<EntityId, string>();
    for (const attachment of liveAttachments ?? []) {
      if (
        attachment.entityType === "event" &&
        !map.has(attachment.entityId)
      ) {
        map.set(attachment.entityId, attachment.dataUrl);
      }
    }
    return map;
  }, [liveAttachments]);

  const chapterById = new Map(
    chapters.map((chapter) => [chapter.id, chapter] as const),
  );
  const characterById = new Map(
    characters.map((character) => [character.id, character] as const),
  );
  const locationById = new Map(
    locations.map((location) => [location.id, location] as const),
  );
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene] as const));
  const arcById = new Map(arcs.map((arc) => [arc.id, arc] as const));
  const beatById = new Map(beats.map((beat) => [beat.id, beat] as const));

  /** Beat do evento via cena — a cena é a ponte estrutura ↔ timeline. */
  function beatForEvent(event: TimelineEvent) {
    const scene = event.linkedSceneId
      ? sceneById.get(event.linkedSceneId)
      : undefined;
    return scene?.beatId ? beatById.get(scene.beatId) : undefined;
  }

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

  async function removeArc(arc: NarrativeArc) {
    await narrativeArcRepository.softDelete(arc.id);
    toast(`"${arc.name}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void narrativeArcRepository.restore(arc.id);
        },
      },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Planejamento"
        title="Linha do tempo"
        description="Marcos da história em ordem cronológica."
        count={
          events.length > 0
            ? `${events.length} ${events.length === 1 ? "evento" : "eventos"}`
            : undefined
        }
      >
        <Button
          onClick={() => setDialog({ open: true })}
          disabled={!projectId}
        >
          <Plus aria-hidden />
          Novo evento
        </Button>
      </PageHeader>

      {projectId === null ? (
        <EmptyState
          title="Nenhum projeto ativo"
          hint="Crie um projeto para montar a linha do tempo."
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList aria-label="Visualizações da linha do tempo">
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="arcs">Arcos</TabsTrigger>
            <TabsTrigger value="state">Estado e alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="mt-6 grid gap-4">
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
              <EmptyState
                title="Nenhum evento ainda"
                hint="Registre marcos da história em ordem cronológica."
              />
            ) : (
              <ol className="relative grid gap-3 border-l border-border/60 pl-6">
                {visible.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[1.95rem] top-2 size-3 rounded-full border-2 border-background bg-primary"
                    />
                    <article className="relative rounded-2xl bg-card/60 p-4 ring-1 ring-border/70">
                      <div className="flex flex-wrap items-start gap-2">
                        <Badge variant="outline" className="font-mono">
                          {event.date}{event.time ? ` · ${event.time}` : ""}
                        </Badge>
                        <h2 className="min-w-0 flex-1 font-serif text-base font-medium tracking-tight">
                          <button
                            type="button"
                            className="text-left hover:underline focus-visible:underline focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
                            onClick={() => setDialog({ open: true, event })}
                          >
                            {event.title}
                          </button>
                        </h2>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-10"
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
                      {(event.characterIds.length > 0 || event.locationId || event.arcIds?.length) ? (
                        <div className="relative z-10 mt-2 flex flex-wrap gap-1">
                          {event.characterIds.map((id) => (
                            <Badge key={id} variant="secondary">
                              {characterById.get(id)?.name ?? "Personagem removido"}
                            </Badge>
                          ))}
                          {event.locationId ? (
                            <Badge variant="outline">
                              {locationById.get(event.locationId)?.name ?? "Local removido"}
                            </Badge>
                          ) : null}
                          {(event.arcIds ?? []).map((id) =>
                            arcById.has(id) ? (
                              <Badge key={id} variant="outline">
                                {arcById.get(id)?.name}
                              </Badge>
                            ) : null,
                          )}
                          {event.linkedSceneId ? (
                            <Badge variant="outline">
                              {sceneById.get(event.linkedSceneId)?.title ?? "Cena removida"}
                            </Badge>
                          ) : null}
                          {(() => {
                            const beat = beatForEvent(event);
                            if (!beat) return null;
                            return (
                              <Link
                                href={`/outline?beat=${beat.id}`}
                                className="relative z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                              >
                                <Layers aria-hidden className="size-3" />
                                Estrutura: {beat.title}
                              </Link>
                            );
                          })()}
                        </div>
                      ) : null}
                      {firstEventImage.get(event.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- dataURL local; next/image não se aplica
                        <img
                          src={firstEventImage.get(event.id)}
                          alt=""
                          className="mt-2 max-h-40 rounded-md border object-cover"
                        />
                      ) : null}
                      {event.linkedChapterId ? (
                        <Link
                          href={`/write/${event.linkedChapterId}`}
                          className="relative z-10 mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
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
          </TabsContent>

          <TabsContent value="arcs" className="mt-4">
            <NarrativeTimeline
              arcs={arcs}
              events={events}
              characters={characters}
              onCreateArc={() => setArcDialog({ open: true })}
              onEditArc={(arc) => setArcDialog({ open: true, arc })}
              onDeleteArc={(arc) => void removeArc(arc)}
              onEditEvent={(event) => setDialog({ open: true, event })}
            />
          </TabsContent>

          <TabsContent value="state" className="mt-4">
            <ContinuityPanel
              characters={characters}
              locations={locations}
              items={items}
              events={events}
              issues={issues}
              onEditEvent={(event) => setDialog({ open: true, event })}
            />
          </TabsContent>
        </Tabs>
      )}

      <EventDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        event={dialog.event ?? null}
        projectId={projectId}
        chapters={chapters}
        characters={characters}
        locations={locations}
        scenes={scenes}
        arcs={arcs}
        items={items}
      />
      <NarrativeArcDialog
        open={arcDialog.open}
        onOpenChange={(open) => setArcDialog((state) => ({ ...state, open }))}
        projectId={projectId}
        arc={arcDialog.arc ?? null}
      />
    </div>
  );
}

