import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IdeaCard } from "@/shared/types/database";

import {
  createGestureTracker,
  dragIdsFor,
  HOLD_MS,
} from "./canvas-gesture";

function pt(x: number, y: number, pointerId = 1) {
  return { x, y, pointerId };
}

function card(id: string, groupId?: string): IdeaCard {
  return { id, groupId } as IdeaCard;
}

describe("createGestureTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toque rápido sem movimento vira tap", () => {
    const onTap = vi.fn();
    const tracker = createGestureTracker({ onTap });
    tracker.start(pt(0, 0));
    tracker.move(pt(3, 2));
    tracker.end(pt(3, 2));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 3, y: 2 });
  });

  it("parado por HOLD_MS vira hold; mover depois trava (não arrasta)", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    const onDragStart = vi.fn();
    const tracker = createGestureTracker({ onTap, onHold, onDragStart });
    tracker.start(pt(0, 0));
    vi.advanceTimersByTime(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(1);
    tracker.move(pt(50, 0));
    expect(onDragStart).not.toHaveBeenCalled();
    tracker.end(pt(50, 0));
    expect(onTap).not.toHaveBeenCalled();
  });

  it("mover além do slop vira drag imediato e cancela o timer de hold", () => {
    const onHold = vi.fn();
    const onDragStart = vi.fn();
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    const tracker = createGestureTracker({
      onHold,
      onDragStart,
      onDragMove,
      onDragEnd,
    });
    tracker.start(pt(0, 0));
    tracker.move(pt(7, 0));
    expect(onDragStart).toHaveBeenCalledTimes(1);
    tracker.move(pt(20, 4));
    expect(onDragMove).toHaveBeenCalledWith({ x: 20, y: 4 });
    vi.advanceTimersByTime(HOLD_MS);
    expect(onHold).not.toHaveBeenCalled();
    tracker.end(pt(20, 4));
    expect(onDragEnd).toHaveBeenCalledWith({ x: 20, y: 4 });
  });

  it("exatamente o slop (6px) ainda é tap, não drag", () => {
    const onTap = vi.fn();
    const onDragStart = vi.fn();
    const tracker = createGestureTracker({ onTap, onDragStart });
    tracker.start(pt(0, 0));
    tracker.move(pt(6, 0));
    tracker.end(pt(6, 0));
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("cancel durante o arraste chama onDragCancel e volta ao idle", () => {
    const onDragCancel = vi.fn();
    const onTap = vi.fn();
    const tracker = createGestureTracker({ onDragCancel, onTap });
    tracker.start(pt(0, 0));
    tracker.move(pt(10, 0));
    tracker.cancel();
    expect(onDragCancel).toHaveBeenCalledTimes(1);
    // Novo gesto funciona em seguida (estado limpo).
    tracker.start(pt(0, 0));
    tracker.end(pt(1, 1));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("cancel no pending não dispara nada", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    const tracker = createGestureTracker({ onTap, onHold });
    tracker.start(pt(0, 0));
    tracker.cancel();
    vi.advanceTimersByTime(HOLD_MS);
    expect(onHold).not.toHaveBeenCalled();
    tracker.end(pt(1, 1));
    expect(onTap).not.toHaveBeenCalled();
  });

  it("segundo ponteiro não rouba o gesto do primeiro", () => {
    const onDragStart = vi.fn();
    const onTap = vi.fn();
    const tracker = createGestureTracker({ onDragStart, onTap });
    tracker.start(pt(0, 0, 1));
    tracker.start(pt(0, 0, 2));
    tracker.move(pt(100, 100, 2));
    expect(onDragStart).not.toHaveBeenCalled();
    tracker.end(pt(100, 100, 2));
    expect(onTap).not.toHaveBeenCalled();
    tracker.move(pt(7, 0, 1));
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("modo alça (holdMs 0, sem lock) arrasta mesmo após o timer", () => {
    const onDragStart = vi.fn();
    const tracker = createGestureTracker({
      holdMs: 0,
      lockAfterHold: false,
      onDragStart,
    });
    tracker.start(pt(0, 0));
    vi.advanceTimersByTime(0);
    tracker.move(pt(7, 0));
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });
});

describe("dragIdsFor", () => {
  it("grupo persistente arrasta todos os membros juntos", () => {
    const cards = [card("a", "g"), card("b", "g"), card("c")];
    expect(dragIdsFor(cards[0]!, cards, new Set(["c"]))).toEqual(["a", "b"]);
  });

  it("card selecionado arrasta a seleção inteira (só os vivos)", () => {
    const cards = [card("a"), card("b"), card("c")];
    expect(dragIdsFor(cards[1]!, cards, new Set(["a", "b", "x"]))).toEqual([
      "a",
      "b",
    ]);
  });

  it("card fora da seleção arrasta sozinho", () => {
    const cards = [card("a"), card("b"), card("c")];
    expect(dragIdsFor(cards[2]!, cards, new Set(["a", "b"]))).toEqual(["c"]);
  });

  it("sem grupo e sem seleção: só o card", () => {
    const cards = [card("a")];
    expect(dragIdsFor(cards[0]!, cards, new Set())).toEqual(["a"]);
  });
});
