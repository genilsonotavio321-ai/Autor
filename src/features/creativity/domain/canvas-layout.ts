import type { EntityId } from "@/shared/types/database";

/** Posição mínima que o layout precisa (IdeaCard já satisfaz). */
export interface LayoutCard {
  id: EntityId;
  x: number;
  y: number;
}

/** Mudança de posição calculada (formato de lote de undo). */
export interface LayoutMove {
  id: EntityId;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Alinha todos ao topo do card mais alto (menor y). */
export function alignTop(cards: LayoutCard[]): LayoutMove[] {
  const target = Math.min(...cards.map((card) => card.y));
  return cards
    .filter((card) => card.y !== target)
    .map((card) => ({
      id: card.id,
      from: { x: card.x, y: card.y },
      to: { x: card.x, y: target },
    }));
}

/** Alinha todos à esquerda do card mais à esquerda (menor x). */
export function alignLeft(cards: LayoutCard[]): LayoutMove[] {
  const target = Math.min(...cards.map((card) => card.x));
  return cards
    .filter((card) => card.x !== target)
    .map((card) => ({
      id: card.id,
      from: { x: card.x, y: card.y },
      to: { x: target, y: card.y },
    }));
}

/** Espaça uniformemente na vertical; extremos ficam, <3 cards é no-op. */
export function distributeVertically(cards: LayoutCard[]): LayoutMove[] {
  return distribute(cards, "y");
}

/** Espaça uniformemente na horizontal; extremos ficam, <3 cards é no-op. */
export function distributeHorizontally(cards: LayoutCard[]): LayoutMove[] {
  return distribute(cards, "x");
}

function distribute(cards: LayoutCard[], axis: "x" | "y"): LayoutMove[] {
  if (cards.length < 3) return [];
  const sorted = [...cards].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0]![axis];
  const last = sorted[sorted.length - 1]![axis];
  const gap = (last - first) / (sorted.length - 1);
  const moves: LayoutMove[] = [];
  sorted.forEach((card, index) => {
    const target = first + gap * index;
    if (card[axis] === target) return;
    moves.push({
      id: card.id,
      from: { x: card.x, y: card.y },
      to:
        axis === "y"
          ? { x: card.x, y: target }
          : { x: target, y: card.y },
    });
  });
  return moves;
}
