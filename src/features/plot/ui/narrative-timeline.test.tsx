import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Character,
  NarrativeArc,
  TimelineEvent,
} from "@/shared/types/database";

import { NarrativeTimeline } from "./narrative-timeline";

const now = "2026-01-01T00:00:00.000Z";

afterEach(cleanup);

function arc(id: string, name: string): NarrativeArc {
  return {
    id,
    projectId: "p1",
    name,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function event(id: string, arcIds: string[]): TimelineEvent {
  return {
    id,
    projectId: "p1",
    date: "1889-05-12",
    time: "10:00",
    title: "Chegada ao castelo",
    characterIds: ["ana"],
    locationId: "castle",
    arcIds,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

const characters: Character[] = [
  {
    id: "ana",
    projectId: "p1",
    name: "Ana",
    role: "protagonist",
    traits: [],
    relationships: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  },
];

describe("NarrativeTimeline", () => {
  it("keeps each arc and its icon actions inside one inline box", () => {
    const storyArc = arc("arc-a", "Jornada de Ana");
    const onEditArc = vi.fn();
    const onDeleteArc = vi.fn();

    render(
      <NarrativeTimeline
        arcs={[storyArc]}
        events={[event("event-1", [storyArc.id])]}
        characters={characters}
        onCreateArc={vi.fn()}
        onEditArc={onEditArc}
        onDeleteArc={onDeleteArc}
        onEditEvent={vi.fn()}
      />,
    );

    const columns = screen.getByRole("table").querySelectorAll("colgroup col");
    expect(columns).toHaveLength(2);
    expect(columns[0]?.className).toContain("w-64");
    expect(columns[1]?.className).toContain("w-52");

    const editButton = screen.getByRole("button", {
      name: "Editar arco Jornada de Ana",
    });
    const deleteButton = screen.getByRole("button", {
      name: "Excluir arco Jornada de Ana",
    });
    const arcBox = editButton.closest("th")?.querySelector("div.rounded-md.border");
    expect(arcBox).toBeTruthy();
    expect(arcBox).toHaveClass("flex", "flex-nowrap", "items-center");
    expect(arcBox).toContainElement(screen.getByText("Jornada de Ana"));
    expect(arcBox).toContainElement(editButton);
    expect(arcBox).toContainElement(deleteButton);
    expect(editButton).toHaveClass("size-10");
    expect(deleteButton).toHaveClass("size-10");
    expect(editButton.textContent).toBe("");
    expect(editButton.querySelector("svg")).toBeTruthy();
    expect(deleteButton.textContent).toBe("");
    expect(deleteButton.querySelector("svg")).toBeTruthy();

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);
    expect(onEditArc).toHaveBeenCalledWith(storyArc);
    expect(onDeleteArc).toHaveBeenCalledWith(storyArc);
  });

  it("shows event lanes and marks a shared character crossing arcs", () => {
    const arcs = [arc("arc-a", "Jornada de Ana"), arc("arc-b", "Segredo do reino")];
    const storyEvent = event("event-1", arcs.map((item) => item.id));
    const onEditEvent = vi.fn();

    render(
      <NarrativeTimeline
        arcs={arcs}
        events={[storyEvent]}
        characters={characters}
        onCreateArc={vi.fn()}
        onEditArc={vi.fn()}
        onDeleteArc={vi.fn()}
        onEditEvent={onEditEvent}
      />,
    );

    expect(screen.getByText("Jornada de Ana")).toBeTruthy();
    expect(screen.getByText("Segredo do reino")).toBeTruthy();
    expect(screen.getByText("Cruzamento · Ana")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /Chegada ao castelo/ })[0]!);
    expect(onEditEvent).toHaveBeenCalledWith(storyEvent);
  });

  it("keeps existing arcs visible before events are linked", () => {
    render(
      <NarrativeTimeline
        arcs={[arc("arc-a", "Jornada de Ana")]}
        events={[]}
        characters={characters}
        onCreateArc={vi.fn()}
        onEditArc={vi.fn()}
        onDeleteArc={vi.fn()}
        onEditEvent={vi.fn()}
      />,
    );

    expect(screen.getByText("Jornada de Ana")).toBeTruthy();
    expect(screen.getByText("Nenhum evento vinculado.")).toBeTruthy();
  });
});
