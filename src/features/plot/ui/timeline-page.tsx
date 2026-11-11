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
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import { attachmentRepository } from "@/features/attachments/infra/dexie-attachment-repository";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import type {
  Chapter,
  Character,
  EntityId,
  Location,
  LoreEntry,
  NarrativeArc,
  Scene,
  StoryItem,
  TimelineEvent,
  TimelineStateChange,
} from "@/shared/types/database";

import { findContinuityIssues, isValidStoryDate } from "../domain/continuity";
import { narrativeArcRepository } from "../infra/dexie-narrative-arc-repository";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";
import { sceneRepository } from "../infra/dexie-scene-repository";
import { timelineEventRepository } from "../infra/dexie-timeline-event-repository";
import { ContinuityPanel } from "./continuity-panel";
import { NarrativeArcDialog } from "./narrative-arc-dialog";
import { NarrativeTimeline } from "./narrative-timeline";

const NO_LINK = "__none__";
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
    playUiSound("delete");
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
    playUiSound("delete");
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
        title="Linha do tempo"
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
        <EmptyState>Crie um projeto para montar a linha do tempo.</EmptyState>
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
              <EmptyState>
                Nenhum evento ainda. Registre marcos da história em ordem
                cronológica.
              </EmptyState>
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

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEvent | null;
  projectId: EntityId | null;
  chapters: Chapter[];
  characters: Character[];
  locations: Location[];
  scenes: Scene[];
  arcs: NarrativeArc[];
  items: StoryItem[];
}

function EventDialog({
  open,
  onOpenChange,
  event,
  projectId,
  chapters,
  characters,
  locations,
  scenes,
  arcs,
  items,
}: EventDialogProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chapterId, setChapterId] = useState(NO_LINK);
  const [sceneId, setSceneId] = useState(NO_LINK);
  const [locationId, setLocationId] = useState(NO_LINK);
  const [characterIds, setCharacterIds] = useState<EntityId[]>([]);
  const [arcIds, setArcIds] = useState<EntityId[]>([]);
  const [stateChanges, setStateChanges] = useState<TimelineStateChange[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Stable dialog key: "new" for creation, the event id when editing.
  const editKey = event?.id ?? "new";
  if (open && editKey !== lastId) {
    const linkedScene = event?.linkedSceneId
      ? scenes.find((scene) => scene.id === event.linkedSceneId)
      : undefined;
    setLastId(editKey);
    setDate(event?.date ?? "");
    setTime(event?.time ?? "");
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setChapterId(event?.linkedChapterId ?? NO_LINK);
    setSceneId(event?.linkedSceneId ?? NO_LINK);
    setLocationId(event?.locationId ?? linkedScene?.locationId ?? NO_LINK);
    setCharacterIds(
      event?.characterIds.length
        ? event.characterIds
        : linkedScene?.povCharacterId
          ? [linkedScene.povCharacterId]
          : [],
    );
    setArcIds(event?.arcIds ?? []);
    setStateChanges(event?.stateChanges ?? []);
  }
  if (!open && lastId !== null) setLastId(null);

  function toggleId(
    id: EntityId,
    setIds: (update: (current: EntityId[]) => EntityId[]) => void,
  ) {
    setIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function updateStateChange(
    index: number,
    update: (change: TimelineStateChange) => TimelineStateChange,
  ) {
    setStateChanges((current) =>
      current.map((change, changeIndex) =>
        changeIndex === index ? update(change) : change,
      ),
    );
  }

  function changeItemAction(
    index: number,
    action: "acquire" | "transfer" | "use" | "lose" | "destroy",
  ) {
    updateStateChange(index, (change) => {
      if (change.kind !== "item") return change;
      if (action === "destroy") {
        return { kind: "item", action, itemId: change.itemId };
      }
      if (action === "lose") {
        return {
          kind: "item",
          action,
          itemId: change.itemId,
          ...(change.action === "destroy" || !change.characterId
            ? {}
            : { characterId: change.characterId }),
        };
      }
      return {
        kind: "item",
        action,
        itemId: change.itemId,
        characterId:
          change.action === "destroy" || !change.characterId
            ? (characters[0]?.id ?? "")
            : change.characterId,
      };
    });
  }

  function addCharacterChange() {
    const character = characters[0];
    if (!character) return;
    setStateChanges((current) => [
      ...current,
      { kind: "character", characterId: character.id },
    ]);
  }

  function addItemChange() {
    const item = items[0];
    if (!item) return;
    setStateChanges((current) => [
      ...current,
      { kind: "item", action: "destroy", itemId: item.id },
    ]);
  }

  const validStateChanges = stateChanges.filter((change) => {
    if (change.kind === "character") {
      return (
        Boolean(change.characterId) &&
        (change.motivation !== undefined ||
          change.physicalCondition !== undefined)
      );
    }
    if (!change.itemId) return false;
    return (
      change.action === "destroy" ||
      change.action === "lose" ||
      Boolean(change.characterId)
    );
  });
  const validDate = isValidStoryDate(date.trim());

  async function submit() {
    if (!projectId || !title.trim()) return;
    if (!validDate) {
      toast.error("Use uma data no formato AAAA, AAAA-MM ou AAAA-MM-DD.");
      return;
    }
    setSaving(true);
    try {
      const linkedScene =
        sceneId === NO_LINK ? undefined : scenes.find((scene) => scene.id === sceneId);
      const linkedChapterId = linkedScene?.chapterId ??
        (chapterId === NO_LINK ? null : chapterId);
      const linkedSceneId = linkedScene?.id ?? null;
      const linkedLocationId = locationId === NO_LINK ? null : locationId;
      if (event) {
        await timelineEventRepository.update(event.id, {
          date,
          time: time.trim() || null,
          title,
          description,
          characterIds,
          locationId: linkedLocationId,
          linkedChapterId,
          linkedSceneId,
          arcIds,
          stateChanges: validStateChanges,
        });
        toast.success("Evento atualizado");
      } else {
        await timelineEventRepository.create({
          projectId,
          date,
          time: time.trim() || undefined,
          title,
          description,
          characterIds,
          locationId: linkedLocationId ?? undefined,
          linkedChapterId: linkedChapterId ?? undefined,
          linkedSceneId: linkedSceneId ?? undefined,
          arcIds,
          stateChanges: validStateChanges,
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
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
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
            <Label htmlFor="event-date">Data</Label>
            <Input
              id="event-date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              placeholder="1889, 1889-05 ou 1889-05-12"
              aria-invalid={date.trim().length > 0 && !validDate}
              aria-describedby={
                date.trim().length > 0 && !validDate
                  ? "event-date-error"
                  : undefined
              }
            />
            {date.trim().length > 0 && !validDate ? (
              <p id="event-date-error" role="alert" className="text-xs text-destructive">
                Use AAAA, AAAA-MM ou AAAA-MM-DD.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-time">Horário na história</Label>
            <Input
              id="event-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Informe horário para confirmar conflitos no mesmo dia. Sem horário,
              sistema marca sobreposição como possível.
            </p>
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
          <div className="grid gap-2">
            <Label>Cena vinculada</Label>
            <Select
              value={sceneId}
              onValueChange={(value) => {
                setSceneId(value);
                const selectedScene = scenes.find((scene) => scene.id === value);
                if (!selectedScene) return;
                setChapterId(selectedScene.chapterId);
                if (selectedScene.locationId) {
                  setLocationId((current) =>
                    current === NO_LINK ? selectedScene.locationId! : current,
                  );
                }
                if (selectedScene.povCharacterId) {
                  setCharacterIds((current) =>
                    current.includes(selectedScene.povCharacterId!)
                      ? current
                      : [...current, selectedScene.povCharacterId!],
                  );
                }
              }}
            >
              <SelectTrigger aria-label="Cena do evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>Nenhuma</SelectItem>
                {scenes.map((scene) => (
                  <SelectItem key={scene.id} value={scene.id}>
                    {chapterByIdLabel(chapters, scene.chapterId)} · {scene.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Local</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger aria-label="Local do evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>Não informado</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Personagens presentes</legend>
            {characters.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={characterIds.includes(character.id)}
                      onChange={() =>
                        toggleId(character.id, setCharacterIds)
                      }
                      className="size-4 accent-primary"
                    />
                    {character.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cadastre personagens para registrar presenças.
              </p>
            )}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Arcos narrativos</legend>
            {arcs.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {arcs.map((arc) => (
                  <label key={arc.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={arcIds.includes(arc.id)}
                      onChange={() => toggleId(arc.id, setArcIds)}
                      className="size-4 accent-primary"
                    />
                    {arc.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Crie arcos na aba Arcos para separar as faixas da linha do tempo.
              </p>
            )}
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Mudanças de estado</legend>
            {stateChanges.map((change, index) => (
              <div
                key={`${change.kind}-${index}`}
                className="grid gap-2 rounded-md border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {change.kind === "character" ? "Personagem" : "Objeto"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setStateChanges((current) =>
                        current.filter((_, changeIndex) => changeIndex !== index),
                      )
                    }
                  >
                    Remover
                  </Button>
                </div>
                {change.kind === "character" ? (
                  <>
                    <Select
                      value={change.characterId}
                      onValueChange={(characterId) =>
                        updateStateChange(index, (current) =>
                          current.kind === "character"
                            ? { ...current, characterId }
                            : current,
                        )
                      }
                    >
                      <SelectTrigger aria-label="Personagem cuja situação mudou">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {characters.map((character) => (
                          <SelectItem key={character.id} value={character.id}>
                            {character.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label="Motivação ativa"
                      value={change.motivation ?? ""}
                      onChange={(inputEvent) =>
                        updateStateChange(index, (current) =>
                          current.kind === "character"
                            ? { ...current, motivation: inputEvent.target.value }
                            : current,
                        )
                      }
                      placeholder="Motivação ativa"
                    />
                    <Input
                      aria-label="Estado físico"
                      value={change.physicalCondition ?? ""}
                      onChange={(inputEvent) =>
                        updateStateChange(index, (current) =>
                          current.kind === "character"
                            ? {
                                ...current,
                                physicalCondition: inputEvent.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="Estado físico"
                    />
                  </>
                ) : (
                  <>
                    <Select
                      value={change.itemId}
                      onValueChange={(itemId) =>
                        updateStateChange(index, (current) =>
                          current.kind === "item" ? { ...current, itemId } : current,
                        )
                      }
                    >
                      <SelectTrigger aria-label="Objeto alterado">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!items.some((item) => item.id === change.itemId) ? (
                          <SelectItem value={change.itemId}>
                            Objeto removido da Bíblia
                          </SelectItem>
                        ) : null}
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={change.action}
                      onValueChange={(action) =>
                        changeItemAction(
                          index,
                          action as
                            | "acquire"
                            | "transfer"
                            | "use"
                            | "lose"
                            | "destroy",
                        )
                      }
                    >
                      <SelectTrigger aria-label="Ação com o objeto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acquire">Adquirido por</SelectItem>
                        <SelectItem value="transfer">Transferido para</SelectItem>
                        <SelectItem value="use">Usado por</SelectItem>
                        <SelectItem value="lose">Perdido</SelectItem>
                        <SelectItem value="destroy">Destruído</SelectItem>
                      </SelectContent>
                    </Select>
                    {change.action !== "destroy" ? (
                      <Select
                        value={change.characterId ?? NO_LINK}
                        onValueChange={(characterId) =>
                          updateStateChange(index, (current) => {
                            if (current.kind !== "item") return current;
                            if (current.action === "destroy") return current;
                            if (current.action === "lose") {
                              return {
                                ...current,
                                ...(characterId === NO_LINK
                                  ? { characterId: undefined }
                                  : { characterId }),
                              };
                            }
                            return { ...current, characterId };
                          })
                        }
                      >
                        <SelectTrigger aria-label="Personagem relacionado ao objeto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_LINK}>Não informado</SelectItem>
                          {characters.map((character) => (
                            <SelectItem key={character.id} value={character.id}>
                              {character.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCharacterChange}
                disabled={characters.length === 0}
              >
                Atualizar personagem
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItemChange}
                disabled={items.length === 0}
              >
                Registrar ação de objeto
              </Button>
            </div>
          </fieldset>
          <ImageAttachments
            entityType="event"
            entityId={event?.id}
            projectId={projectId}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !title.trim() || !validDate}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function chapterByIdLabel(chapters: Chapter[], chapterId: EntityId): string {
  return chapters.find((chapter) => chapter.id === chapterId)?.title ??
    "Capítulo";
}
