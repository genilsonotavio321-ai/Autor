"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { Pencil, Trash2 } from "lucide-react";
import type {
  Character,
  EntityId,
  NarrativeArc,
  TimelineEvent,
} from "@/shared/types/database";

interface NarrativeTimelineProps {
  arcs: NarrativeArc[];
  events: TimelineEvent[];
  characters: Character[];
  onCreateArc: () => void;
  onEditArc: (arc: NarrativeArc) => void;
  onDeleteArc: (arc: NarrativeArc) => void;
  onEditEvent: (event: TimelineEvent) => void;
}

function momentKey(event: TimelineEvent): string {
  return `${event.date}${event.time ? `T${event.time}` : ""}`;
}

function compareMoments(a: string, b: string): number {
  return a.localeCompare(b);
}

export function NarrativeTimeline({
  arcs,
  events,
  characters,
  onCreateArc,
  onEditArc,
  onDeleteArc,
  onEditEvent,
}: NarrativeTimelineProps) {
  const arcIds = new Set(arcs.map((arc) => arc.id));
  const moments = [...new Set(events.map(momentKey))].sort(compareMoments);
  const displayMoments = moments.length > 0 ? moments : ["__empty__"];
  const characterNames = new Map(
    characters.map((character) => [character.id, character.name] as const),
  );
  const arcByCharacterAndMoment = new Map<
    string,
    Map<EntityId, Set<EntityId>>
  >();

  for (const event of events) {
    const linkedArcIds = (event.arcIds ?? []).filter((id) => arcIds.has(id));
    if (linkedArcIds.length === 0) continue;
    const byCharacter = arcByCharacterAndMoment.get(momentKey(event)) ?? new Map();
    for (const characterId of event.characterIds) {
      const linked = byCharacter.get(characterId) ?? new Set<EntityId>();
      for (const arcId of linkedArcIds) linked.add(arcId);
      byCharacter.set(characterId, linked);
    }
    arcByCharacterAndMoment.set(momentKey(event), byCharacter);
  }

  const hasUnassignedLane = events.some(
    (event) => !(event.arcIds ?? []).some((id) => arcIds.has(id)),
  );
  const lanes: Array<{ id: EntityId | null; name: string; arc?: NarrativeArc }> = [
    ...arcs.map((arc) => ({ id: arc.id, name: arc.name, arc })),
    ...(hasUnassignedLane || arcs.length === 0
      ? [{ id: null, name: "Sem arco" }]
      : []),
  ];

  function eventsForLaneAndMoment(
    laneId: EntityId | null,
    moment: string,
  ): TimelineEvent[] {
    return events.filter((event) => {
      if (momentKey(event) !== moment) return false;
      const linkedArcIds = (event.arcIds ?? []).filter((id) => arcIds.has(id));
      return laneId ? linkedArcIds.includes(laneId) : linkedArcIds.length === 0;
    });
  }

  return (
    <section className="grid gap-4" aria-labelledby="narrative-timeline-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="narrative-timeline-title" className="font-medium">
            Arcos narrativos
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada faixa segue eventos ligados ao mesmo arco.
          </p>
        </div>
        <Button onClick={onCreateArc}>Novo arco</Button>
      </div>

      {events.length === 0 && arcs.length === 0 ? (
        <EmptyState>
          Registre eventos e vincule cada um a um arco para montar a visão
          multicamada.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max table-fixed border-collapse">
            <caption className="sr-only">
              Eventos por arco narrativo e momento da história
            </caption>
            <colgroup>
              <col className="w-64" />
              {displayMoments.map((moment) => (
                <col key={moment} className="w-52" />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="sticky left-0 z-10 w-64 bg-muted p-3">
                  Arco
                </th>
                {displayMoments.map((moment) => {
                  if (moment === "__empty__") {
                    return (
                      <th
                        key="no-moments"
                        scope="col"
                        className="w-52 border-l p-3 align-top"
                      >
                        Eventos
                      </th>
                    );
                  }
                  const [date, time] = moment.split("T");
                  const crossingCharacters = [
                    ...(arcByCharacterAndMoment.get(moment) ?? new Map()),
                  ]
                    .filter(([, linked]) => linked.size > 1)
                    .map(([id]) => ({
                      id,
                      name: characterNames.get(id) ?? "Personagem",
                    }));
                  const crossingLabel = /^\d{4}-\d{2}-\d{2}T/.test(moment)
                    ? "Cruzamento"
                    : "Cruzamento possível";
                  return (
                    <th
                      key={moment}
                      scope="col"
                      className="w-52 border-l p-3 align-top"
                    >
                      <span className="block font-mono text-xs">{date}</span>
                      {time ? (
                        <span className="block text-xs text-muted-foreground">
                          {time}
                        </span>
                      ) : null}
                      {crossingCharacters.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {crossingCharacters.map(({ id, name }) => (
                            <Badge key={id} variant="secondary">
                              {crossingLabel} · {name}
                            </Badge>
                          ))}
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lanes.map((lane) => (
                <tr key={lane.id ?? "unassigned"} className="border-b last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-64 bg-background p-3 text-left align-top"
                  >
                    <div
                      className={
                        lane.arc
                          ? "flex min-w-0 flex-nowrap items-center gap-2 rounded-md border bg-card p-1"
                          : "flex min-w-0 items-center gap-2"
                      }
                    >
                      {lane.arc ? (
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: /^#[\da-f]{6}$/i.test(
                              lane.arc.color ?? "",
                            )
                              ? lane.arc.color
                              : "var(--primary)",
                          }}
                        />
                      ) : null}
                      <span
                        className={
                          lane.arc
                            ? "min-w-0 flex-1 truncate font-medium"
                            : "font-medium"
                        }
                        title={lane.name}
                      >
                        {lane.name}
                      </span>
                      {lane.arc ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            aria-label={`Editar arco ${lane.arc.name}`}
                            onClick={() => onEditArc(lane.arc!)}
                          >
                            <Pencil aria-hidden className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 text-destructive"
                            aria-label={`Excluir arco ${lane.arc.name}`}
                            onClick={() => onDeleteArc(lane.arc!)}
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </Button>
                        </span>
                      ) : null}
                    </div>
                  </th>
                  {displayMoments.map((moment) => {
                    if (moment === "__empty__") {
                      return (
                        <td
                          key={`${lane.id ?? "unassigned"}:no-moments`}
                          className="w-52 border-l p-3 align-top text-sm text-muted-foreground"
                        >
                          Nenhum evento vinculado.
                        </td>
                      );
                    }
                    const cellEvents = eventsForLaneAndMoment(lane.id, moment);
                    const crossingCharacterIds = new Set(
                      [...(arcByCharacterAndMoment.get(moment) ?? new Map())]
                        .filter(([, linked]) => linked.size > 1)
                        .map(([id]) => id),
                    );
                    const crossingLabel = /^\d{4}-\d{2}-\d{2}T/.test(moment)
                      ? "Cruzamento"
                      : "Cruzamento possível";
                    return (
                      <td
                        key={`${lane.id ?? "unassigned"}:${moment}`}
                        className="w-52 border-l p-2 align-top"
                      >
                        <ul className="grid gap-2">
                          {cellEvents.map((event) => {
                            const crossingNames = event.characterIds
                              .filter((id) => crossingCharacterIds.has(id))
                              .map((id) => characterNames.get(id) ?? "Personagem");
                            return (
                              <li key={event.id}>
                                <button
                                  type="button"
                                  onClick={() => onEditEvent(event)}
                                  className="w-full rounded-md border bg-card p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                  <span className="block break-words text-sm font-medium">
                                    {event.title}
                                  </span>
                                  {event.characterIds.length > 0 ? (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      {event.characterIds
                                        .map((id) => characterNames.get(id) ?? "Personagem")
                                        .join(", ")}
                                    </span>
                                  ) : null}
                                  {crossingNames.length > 0 ? (
                                    <span className="mt-1 block text-xs font-medium text-primary">
                                      {crossingLabel}: {crossingNames.join(", ")}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
