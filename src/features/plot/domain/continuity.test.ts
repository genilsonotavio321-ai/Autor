import { describe, expect, it } from "vitest";

import type { StoryItem, TimelineEvent } from "@/shared/types/database";

import {
  deriveContinuityState,
  findContinuityIssues,
  isValidStoryDate,
} from "./continuity";

const now = "2026-01-01T00:00:00.000Z";

function event(
  id: string,
  date: string,
  patch: Partial<TimelineEvent> = {},
): TimelineEvent {
  return {
    id,
    projectId: "p1",
    date,
    title: id,
    characterIds: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

const sword: StoryItem = {
  id: "sword",
  name: "Espada",
  initialOwnerId: "ana",
};

describe("isValidStoryDate", () => {
  it.each(["0012", "1889", "1889-05", "1889-05-12"])(
    "accepts supported date precision %s",
    (date) => expect(isValidStoryDate(date)).toBe(true),
  );

  it.each(["1889-13", "1889-02-30", "1889/05"])(
    "rejects malformed date %s",
    (date) => expect(isValidStoryDate(date)).toBe(false),
  );
});

describe("findContinuityIssues", () => {
  it("finds confirmed conflicting locations at the same exact moment", () => {
    const issues = findContinuityIssues([
      event("a", "1889-05-12", {
        time: "10:00",
        characterIds: ["ana"],
        locationId: "castle",
      }),
      event("b", "1889-05-12", {
        time: "10:00",
        characterIds: ["ana"],
        locationId: "forest",
      }),
    ]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "location-conflict",
        severity: "confirmed",
        characterId: "ana",
        eventId: "b",
        relatedEventId: "a",
      }),
    );
  });

  it("marks overlapping date-only locations as possible, not confirmed", () => {
    const issues = findContinuityIssues([
      event("a", "1889-05-12", {
        characterIds: ["ana"],
        locationId: "castle",
      }),
      event("b", "1889-05-12", {
        characterIds: ["ana"],
        locationId: "forest",
      }),
    ]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "location-conflict",
        severity: "possible",
      }),
    );
  });

  it("does not flag different times on the same date", () => {
    const issues = findContinuityIssues([
      event("a", "1889-05-12", {
        time: "10:00",
        characterIds: ["ana"],
        locationId: "castle",
      }),
      event("b", "1889-05-12", {
        time: "11:00",
        characterIds: ["ana"],
        locationId: "forest",
      }),
    ]);

    expect(issues).toEqual([]);
  });

  it("flags item use after loss or destruction with the source event", () => {
    const issues = findContinuityIssues([
      event("destroy", "1889-05-12", {
        stateChanges: [{ kind: "item", action: "destroy", itemId: sword.id }],
      }),
      event("use", "1890-01-01", {
        stateChanges: [
          { kind: "item", action: "use", itemId: sword.id, characterId: "ana" },
        ],
      }),
    ]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "item-used-after-destruction",
        severity: "confirmed",
        eventId: "use",
        relatedEventId: "destroy",
        itemId: sword.id,
      }),
    );
  });

  it("warns when a lost item is used before it is recovered", () => {
    const issues = findContinuityIssues(
      [
        event("lost", "1889-05-12", {
          stateChanges: [
            { kind: "item", action: "lose", itemId: sword.id, characterId: "ana" },
          ],
        }),
        event("use", "1890-01-01", {
          stateChanges: [
            { kind: "item", action: "use", itemId: sword.id, characterId: "ana" },
          ],
        }),
      ],
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "item-used-after-loss",
        severity: "confirmed",
        eventId: "use",
        relatedEventId: "lost",
      }),
    );
  });

  it("does not flag use after an item was recovered", () => {
    const issues = findContinuityIssues(
      [
        event("lost", "1889-05-12", {
          stateChanges: [{ kind: "item", action: "lose", itemId: sword.id }],
        }),
        event("recovered", "1890-01-01", {
          stateChanges: [
            { kind: "item", action: "acquire", itemId: sword.id, characterId: "ana" },
          ],
        }),
        event("use", "1890-02-01", {
          stateChanges: [
            { kind: "item", action: "use", itemId: sword.id, characterId: "ana" },
          ],
        }),
      ],
    );

    expect(issues).toEqual([]);
  });
});

describe("deriveContinuityState", () => {
  it("derives character state and item ownership at a selected event", () => {
    const events = [
      event("arrival", "1889-05-12", {
        characterIds: ["ana"],
        locationId: "castle",
        stateChanges: [
          {
            kind: "character",
            characterId: "ana",
            motivation: "Encontrar a irmã",
            physicalCondition: "Ferida",
          },
        ],
      }),
      event("transfer", "1890-01-01", {
        stateChanges: [
          {
            kind: "item",
            action: "transfer",
            itemId: sword.id,
            characterId: "rui",
          },
        ],
      }),
    ];

    const atArrival = deriveContinuityState(events, [sword], "arrival");
    expect(atArrival.characters.get("ana")).toMatchObject({
      locationId: "castle",
      motivation: "Encontrar a irmã",
      physicalCondition: "Ferida",
      inventoryItemIds: [sword.id],
    });
    expect(atArrival.items.get(sword.id)?.ownerCharacterId).toBe("ana");

    const latest = deriveContinuityState(events, [sword]);
    expect(latest.items.get(sword.id)?.ownerCharacterId).toBe("rui");
    expect(latest.characters.get("ana")?.inventoryItemIds).toEqual([]);
    expect(latest.characters.get("rui")?.inventoryItemIds).toEqual([sword.id]);
  });
});
