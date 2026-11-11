import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Character,
  Location,
  StoryItem,
  TimelineEvent,
} from "@/shared/types/database";

import type { ContinuityIssue } from "../domain/continuity";
import { ContinuityPanel } from "./continuity-panel";

const now = "2026-01-01T00:00:00.000Z";

afterEach(cleanup);

const character: Character = {
  id: "ana",
  projectId: "p1",
  name: "Ana",
  role: "protagonist",
  traits: [],
  relationships: [],
  tags: [],
  createdAt: now,
  updatedAt: now,
};

const location: Location = {
  id: "castle",
  projectId: "p1",
  name: "Castelo",
  type: "Fortaleza",
  tags: [],
  createdAt: now,
  updatedAt: now,
};

const item: StoryItem = { id: "sword", name: "Espada" };

function event(id: string, date: string, locationId: string): TimelineEvent {
  return {
    id,
    projectId: "p1",
    date,
    title: id,
    characterIds: ["ana"],
    locationId,
    stateChanges: [
      {
        kind: "character",
        characterId: "ana",
        motivation: "Encontrar a irmã",
        physicalCondition: "Ferida",
      },
      { kind: "item", action: "acquire", itemId: item.id, characterId: "ana" },
    ],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("ContinuityPanel", () => {
  it("shows derived location, motivation, physical state and inventory", () => {
    render(
      <ContinuityPanel
        characters={[character]}
        locations={[location]}
        items={[item]}
        events={[event("arrival", "1889-05-12", location.id)]}
        issues={[]}
        onEditEvent={vi.fn()}
      />,
    );

    expect(screen.getByText("Castelo")).toBeTruthy();
    expect(screen.getByText("Encontrar a irmã")).toBeTruthy();
    expect(screen.getByText("Ferida")).toBeTruthy();
    expect(screen.getAllByText("Espada")).toHaveLength(2);
    expect(screen.getByText("Disponível · Ana")).toBeTruthy();
  });

  it("shows ambiguity and opens the event that needs review", () => {
    const first = event("castle-event", "1889-05-12", "castle");
    const second = event("forest-event", "1889-05-12", "forest");
    const issue: ContinuityIssue = {
      kind: "location-conflict",
      severity: "possible",
      eventId: second.id,
      relatedEventId: first.id,
      characterId: character.id,
    };
    const onEditEvent = vi.fn();

    render(
      <ContinuityPanel
        characters={[character]}
        locations={[location]}
        items={[item]}
        events={[first, second]}
        issues={[issue]}
        onEditEvent={onEditEvent}
      />,
    );

    expect(screen.getByText("Possível")).toBeTruthy();
    expect(screen.getByText(/Ana consta em Castelo e local desconhecido/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir evento" }));
    expect(onEditEvent).toHaveBeenCalledWith(second);
  });
});
