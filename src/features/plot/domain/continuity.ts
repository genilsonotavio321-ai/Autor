import type {
  EntityId,
  StoryItem,
  TimelineEvent,
  TimelineStateChange,
} from "@/shared/types/database";

export type ContinuityIssueKind =
  | "location-conflict"
  | "item-used-after-loss"
  | "item-used-after-destruction";

export interface ContinuityIssue {
  kind: ContinuityIssueKind;
  severity: "confirmed" | "possible";
  eventId: EntityId;
  relatedEventId: EntityId;
  characterId?: EntityId;
  itemId?: EntityId;
}

export interface CharacterContinuityState {
  locationId?: EntityId;
  motivation?: string;
  physicalCondition?: string;
  inventoryItemIds: EntityId[];
  lastEventId?: EntityId;
}

export interface ItemContinuityState {
  status: "available" | "lost" | "destroyed";
  ownerCharacterId?: EntityId;
  lastEventId?: EntityId;
}

export interface ContinuityState {
  characters: Map<EntityId, CharacterContinuityState>;
  items: Map<EntityId, ItemContinuityState>;
}

type TemporalRelation = "before" | "same" | "overlap" | "after";

interface DateRange {
  start: number;
  end: number;
  exactDay: boolean;
}

function utcTimestamp(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month, day);
  return date.getTime();
}

function dateRange(value: string): DateRange | undefined {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dayMatch) {
    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]);
    const day = Number(dayMatch[3]);
    const start = utcTimestamp(year, month - 1, day);
    const date = new Date(start);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return undefined;
    }
    return { start, end: start, exactDay: true };
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(value);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) return undefined;
    return {
      start: utcTimestamp(year, month - 1, 1),
      end: utcTimestamp(year, month, 0),
      exactDay: false,
    };
  }

  const yearMatch = /^(\d{4})$/.exec(value);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      start: utcTimestamp(year, 0, 1),
      end: utcTimestamp(year, 11, 31),
      exactDay: false,
    };
  }

  return undefined;
}

export function isValidStoryDate(value: string): boolean {
  return dateRange(value) !== undefined;
}

function validTime(value: string | undefined): string | undefined {
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : undefined;
}

function temporalRelation(
  first: TimelineEvent,
  second: TimelineEvent,
): TemporalRelation | undefined {
  const firstRange = dateRange(first.date);
  const secondRange = dateRange(second.date);
  if (!firstRange || !secondRange) return undefined;

  if (firstRange.end < secondRange.start) return "before";
  if (firstRange.start > secondRange.end) return "after";

  if (
    firstRange.exactDay &&
    secondRange.exactDay &&
    first.date === second.date
  ) {
    const firstTime = validTime(first.time);
    const secondTime = validTime(second.time);
    if (firstTime && secondTime) {
      if (firstTime < secondTime) return "before";
      if (firstTime > secondTime) return "after";
      return "same";
    }
  }

  return "overlap";
}

function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? "").localeCompare(b.time ?? "") ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

function sortedEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(compareEvents);
}

export function findContinuityIssues(
  events: TimelineEvent[],
): ContinuityIssue[] {
  const ordered = sortedEvents(events);
  const issues: ContinuityIssue[] = [];

  for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
    const first = ordered[firstIndex];
    if (!first?.locationId || first.characterIds.length === 0) continue;

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < ordered.length;
      secondIndex += 1
    ) {
      const second = ordered[secondIndex];
      if (!second?.locationId || second.locationId === first.locationId) continue;

      const relation = temporalRelation(first, second);
      if (relation !== "same" && relation !== "overlap") continue;

      const sharedCharacters = first.characterIds.filter((id) =>
        second.characterIds.includes(id),
      );
      for (const characterId of sharedCharacters) {
        issues.push({
          kind: "location-conflict",
          severity: relation === "same" ? "confirmed" : "possible",
          eventId: second.id,
          relatedEventId: first.id,
          characterId,
        });
      }
    }
  }

  const itemStates = new Map<
    EntityId,
    { status: "available" | "lost" | "destroyed"; event: TimelineEvent }
  >();

  for (const event of ordered) {
    for (const change of event.stateChanges ?? []) {
      if (change.kind !== "item") continue;

      const current = itemStates.get(change.itemId);
      if (change.action === "use" && current?.status !== "available") {
        if (current) {
          const relation = temporalRelation(current.event, event);
          if (relation !== "after") {
            issues.push({
              kind:
                current.status === "lost"
                  ? "item-used-after-loss"
                  : "item-used-after-destruction",
              severity:
                current.event.id === event.id || relation === "before"
                  ? "confirmed"
                  : "possible",
              eventId: event.id,
              relatedEventId: current.event.id,
              itemId: change.itemId,
              characterId: change.characterId,
            });
          }
        }
      }

      if (change.action === "destroy") {
        itemStates.set(change.itemId, { status: "destroyed", event });
      } else if (change.action === "lose") {
        if (current?.status !== "destroyed") {
          itemStates.set(change.itemId, { status: "lost", event });
        }
      } else if (
        (change.action === "acquire" || change.action === "transfer") &&
        current?.status !== "destroyed"
      ) {
        itemStates.set(change.itemId, { status: "available", event });
      }
    }
  }

  return issues;
}

function applyChange(
  state: ContinuityState,
  event: TimelineEvent,
  change: TimelineStateChange,
): void {
  if (change.kind === "character") {
    const character = state.characters.get(change.characterId) ?? {
      inventoryItemIds: [],
    };
    if (change.motivation !== undefined) {
      if (change.motivation === null || !change.motivation.trim()) {
        delete character.motivation;
      } else {
        character.motivation = change.motivation.trim();
      }
    }
    if (change.physicalCondition !== undefined) {
      if (
        change.physicalCondition === null ||
        !change.physicalCondition.trim()
      ) {
        delete character.physicalCondition;
      } else {
        character.physicalCondition = change.physicalCondition.trim();
      }
    }
    character.lastEventId = event.id;
    state.characters.set(change.characterId, character);
    return;
  }

  const item = state.items.get(change.itemId) ?? { status: "available" };
  if (change.action === "destroy") {
    item.status = "destroyed";
    delete item.ownerCharacterId;
  } else if (change.action === "lose") {
    if (item.status !== "destroyed") {
      item.status = "lost";
      delete item.ownerCharacterId;
    }
  } else if (change.action === "acquire" || change.action === "transfer") {
    if (item.status !== "destroyed") {
      item.status = "available";
      item.ownerCharacterId = change.characterId;
    }
  }
  item.lastEventId = event.id;
  state.items.set(change.itemId, item);
  if (change.kind === "item" && change.action !== "destroy") {
    const character = state.characters.get(change.characterId ?? "");
    if (character) character.lastEventId = event.id;
  }
}

export function deriveContinuityState(
  events: TimelineEvent[],
  items: StoryItem[] = [],
  asOfEventId?: EntityId,
): ContinuityState {
  const state: ContinuityState = {
    characters: new Map(),
    items: new Map(
      items.map((item) => [
        item.id,
        {
          status: "available" as const,
          ownerCharacterId: item.initialOwnerId,
        },
      ]),
    ),
  };

  for (const item of items) {
    if (item.initialOwnerId) {
      state.characters.set(item.initialOwnerId, { inventoryItemIds: [] });
    }
  }

  const ordered = sortedEvents(events);
  for (const event of ordered) {
    for (const characterId of event.characterIds) {
      const character = state.characters.get(characterId) ?? {
        inventoryItemIds: [],
      };
      if (event.locationId) character.locationId = event.locationId;
      character.lastEventId = event.id;
      state.characters.set(characterId, character);
    }

    for (const change of event.stateChanges ?? []) {
      applyChange(state, event, change);
    }

    if (asOfEventId === event.id) break;
  }

  for (const [itemId, item] of state.items) {
    if (!item.ownerCharacterId || item.status !== "available") continue;
    const character = state.characters.get(item.ownerCharacterId) ?? {
      inventoryItemIds: [],
    };
    character.inventoryItemIds.push(itemId);
    state.characters.set(item.ownerCharacterId, character);
  }

  return state;
}
