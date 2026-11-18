"use client";

import { useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import type {
  Chapter,
  Character,
  EntityId,
  Location,
  NarrativeArc,
  Scene,
  StoryItem,
  TimelineEvent,
  TimelineStateChange,
} from "@/shared/types/database";

import { isValidStoryDate } from "../domain/continuity";
import { timelineEventRepository } from "../infra/dexie-timeline-event-repository";

const NO_LINK = "__none__";

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

export function EventDialog({
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
      }
      onOpenChange(false);
    } catch {
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
