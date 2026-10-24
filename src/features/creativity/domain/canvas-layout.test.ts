import { describe, expect, it } from "vitest";

import {
  alignLeft,
  alignTop,
  distributeHorizontally,
  distributeVertically,
  type LayoutCard,
} from "./canvas-layout";

const cards: LayoutCard[] = [
  { id: "a", x: 10, y: 40 },
  { id: "b", x: 30, y: 10 },
  { id: "c", x: 20, y: 100 },
];

describe("canvas-layout", () => {
  it("alinha pelo topo (menor y) e não move quem já está", () => {
    expect(alignTop(cards)).toEqual([
      { id: "a", from: { x: 10, y: 40 }, to: { x: 10, y: 10 } },
      { id: "c", from: { x: 20, y: 100 }, to: { x: 20, y: 10 } },
    ]);
  });

  it("alinha pela esquerda (menor x) e não move quem já está", () => {
    expect(alignLeft(cards)).toEqual([
      { id: "b", from: { x: 30, y: 10 }, to: { x: 10, y: 10 } },
      { id: "c", from: { x: 20, y: 100 }, to: { x: 10, y: 100 } },
    ]);
  });

  it("espaça uniformemente na vertical mantendo os extremos", () => {
    const moves = distributeVertically(cards);
    const byId = new Map(moves.map((move) => [move.id, move]));
    // y: b=10, a=40, c=100 → gap 45; só o do meio (a) se move.
    expect(byId.get("a")?.to).toEqual({ x: 10, y: 55 });
    expect(byId.has("b")).toBe(false);
    expect(byId.has("c")).toBe(false);
  });

  it("espaça uniformemente na horizontal ordenando pela posição", () => {
    const uneven: LayoutCard[] = [
      { id: "a", x: 10, y: 1 },
      { id: "b", x: 30, y: 2 },
      { id: "c", x: 100, y: 3 },
    ];
    const moves = distributeHorizontally(uneven);
    const byId = new Map(moves.map((move) => [move.id, move]));
    // x: a=10, b=30, c=100 → gap 45; só o do meio (b) se move.
    expect(byId.get("b")?.to).toEqual({ x: 55, y: 2 });
    expect(byId.has("a")).toBe(false);
    expect(byId.has("c")).toBe(false);
  });

  it("espaçar com menos de 3 cards é no-op", () => {
    expect(distributeVertically(cards.slice(0, 2))).toEqual([]);
    expect(distributeHorizontally([cards[0]!])).toEqual([]);
  });

  it("cards já alinhados não geram mudanças", () => {
    const aligned: LayoutCard[] = [
      { id: "a", x: 5, y: 7 },
      { id: "b", x: 5, y: 7 },
    ];
    expect(alignTop(aligned)).toEqual([]);
    expect(alignLeft(aligned)).toEqual([]);
  });
});
