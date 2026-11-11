"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Character,
  Location,
  StoryItem,
  TimelineEvent,
} from "@/shared/types/database";

import {
  deriveContinuityState,
  type ContinuityIssue,
} from "../domain/continuity";

const LATEST = "__latest__";

interface ContinuityPanelProps {
  characters: Character[];
  locations: Location[];
  items: StoryItem[];
  events: TimelineEvent[];
  issues: ContinuityIssue[];
  onEditEvent: (event: TimelineEvent) => void;
}

export function ContinuityPanel({
  characters,
  locations,
  items,
  events,
  issues,
  onEditEvent,
}: ContinuityPanelProps) {
  const [asOfEventId, setAsOfEventId] = useState(LATEST);
  const state = useMemo(
    () =>
      deriveContinuityState(
        events,
        items,
        asOfEventId === LATEST ? undefined : asOfEventId,
      ),
    [events, items, asOfEventId],
  );
  const characterById = new Map(
    characters.map((character) => [character.id, character] as const),
  );
  const locationById = new Map(
    locations.map((location) => [location.id, location] as const),
  );
  const itemById = new Map(items.map((item) => [item.id, item] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  function issueText(issue: ContinuityIssue): string {
    const event = eventById.get(issue.eventId);
    const related = eventById.get(issue.relatedEventId);
    if (issue.kind === "location-conflict") {
      const characterName = characterById.get(issue.characterId ?? "")?.name ??
        "Personagem";
      const firstLocation = related?.locationId
        ? locationById.get(related.locationId)?.name ?? "local desconhecido"
        : "local desconhecido";
      const secondLocation = event?.locationId
        ? locationById.get(event.locationId)?.name ?? "local desconhecido"
        : "local desconhecido";
      return `${characterName} consta em ${firstLocation} e ${secondLocation} no mesmo momento.`;
    }

    const itemName = itemById.get(issue.itemId ?? "")?.name ?? "Objeto";
    const priorAction =
      issue.kind === "item-used-after-loss" ? "perdido" : "destruído";
    return `${itemName} foi usado em "${event?.title ?? "evento"}" após ser marcado como ${priorAction} em "${related?.title ?? "evento anterior"}".`;
  }

  return (
    <div className="grid gap-6">
      {events.length > 0 ? (
        <div className="grid max-w-xl gap-2">
          <Label>Calcular estado até</Label>
          <Select value={asOfEventId} onValueChange={setAsOfEventId}>
            <SelectTrigger aria-label="Calcular estado até o evento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LATEST}>Momento mais recente</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.date}{event.time ? ` · ${event.time}` : ""} — {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <section className="grid gap-3" aria-labelledby="continuity-issues-title">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {issues.length} alertas de continuidade.
        </p>
        <div className="flex items-center gap-2">
          <h2 id="continuity-issues-title" className="font-medium">
            Continuidade
          </h2>
          <Badge variant={issues.length > 0 ? "destructive" : "secondary"}>
            {issues.length}
          </Badge>
        </div>
        {issues.length === 0 ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Nenhuma inconsistência encontrada nos fatos registrados.
          </p>
        ) : (
          <ul className="grid gap-2">
            {issues.map((issue) => {
              const event = eventById.get(issue.eventId);
              const related = eventById.get(issue.relatedEventId);
              return (
                <li
                  key={`${issue.kind}:${issue.eventId}:${issue.relatedEventId}:${issue.characterId ?? issue.itemId}`}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <Badge
                    variant={issue.severity === "confirmed" ? "destructive" : "outline"}
                  >
                    {issue.severity === "confirmed" ? "Confirmado" : "Possível"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{issueText(issue)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {related?.date ?? ""} · {related?.title ?? "Evento anterior"}
                      {event ? ` → ${event.date} · ${event.title}` : ""}
                    </p>
                  </div>
                  {event ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditEvent(event)}
                    >
                      Abrir evento
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="character-state-title">
        <h2 id="character-state-title" className="font-medium">
          Estado dos personagens
        </h2>
        {characters.length === 0 ? (
          <EmptyState>Cadastre personagens para acompanhar seus estados.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {characters.map((character) => {
              const current = state.characters.get(character.id);
              const inventory = (current?.inventoryItemIds ?? [])
                .map((id) => itemById.get(id)?.name)
                .filter((name): name is string => Boolean(name));
              return (
                <li key={character.id} className="rounded-lg border bg-card p-4">
                  <h3 className="font-medium">{character.name}</h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Local atual</dt>
                      <dd>{
                        current?.locationId
                          ? locationById.get(current.locationId)?.name ?? "Local removido"
                          : "Não registrado"
                      }</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Motivação ativa</dt>
                      <dd>{current?.motivation ?? "Não registrada"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Estado físico</dt>
                      <dd>{current?.physicalCondition ?? "Não registrado"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Inventário</dt>
                      <dd>{inventory.length > 0 ? inventory.join(", ") : "Sem itens registrados"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="item-state-title">
        <h2 id="item-state-title" className="font-medium">
          Estado dos objetos
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Marque entradas de lore como objetos rastreáveis para ver seu estado.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => {
              const current = state.items.get(item.id);
              const owner = current?.ownerCharacterId
                ? characterById.get(current.ownerCharacterId)?.name ?? "Personagem removido"
                : "Sem possuidor";
              const status =
                current?.status === "destroyed"
                  ? "Destruído"
                  : current?.status === "lost"
                    ? "Perdido"
                    : "Disponível";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">{status} · {owner}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
