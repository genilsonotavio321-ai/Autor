import type { EntityId, IdeaBoardItem, IdeaCard } from "@/shared/types/database";

/** Retângulo de um card no espaço do conteúdo (pré-escala do zoom). */
export type CardRect = { x: number; y: number; width: number; height: number };

/** Marquee de seleção em coordenadas do conteúdo. */
export type Marquee = { x0: number; y0: number; x1: number; y1: number };

export function snapshotItems(cards: IdeaCard[]): IdeaBoardItem[] {
  return cards.map((card) => ({
    key: card.id,
    title: card.title,
    content: card.content,
    color: card.color,
    x: card.x,
    y: card.y,
    links: card.links,
    refType: card.refType,
    refId: card.refId,
    w: card.w,
    h: card.h,
    doc: card.doc,
  }));
}

export function sameRects(
  a: Record<EntityId, CardRect>,
  b: Record<EntityId, CardRect>,
): boolean {
  const keys = Object.keys(b);
  if (Object.keys(a).length !== keys.length) return false;
  return keys.every(
    (key) =>
      a[key]?.x === b[key]?.x &&
      a[key]?.y === b[key]?.y &&
      a[key]?.width === b[key]?.width &&
      a[key]?.height === b[key]?.height,
  );
}

/** Rótulo do item que abre o alvo do node (ficha, capítulo ou cena). */
export function refOpenLabel(refType: NonNullable<IdeaCard["refType"]>): string {
  if (refType === "chapter") return "Abrir capítulo";
  if (refType === "scene") return "Abrir cena";
  return "Abrir ficha";
}

export function clampZoom(value: number): number {
  return Math.min(2, Math.max(0.5, value));
}

/** Alvo é o fundo do canvas (não card, botão, alça nem linha de conexão). */
export function isCanvasBackground(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  return !element.closest(
    "[data-card-id], button, a, input, textarea, select, [role='button']",
  );
}

export function rectCenter(rect: CardRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Ids dos cards cujo retângulo cruza o marquee (coords do conteúdo). */
export function marqueeHits(
  rects: Record<EntityId, CardRect>,
  marquee: Marquee,
): EntityId[] {
  const x0 = Math.min(marquee.x0, marquee.x1);
  const x1 = Math.max(marquee.x0, marquee.x1);
  const y0 = Math.min(marquee.y0, marquee.y1);
  const y1 = Math.max(marquee.y0, marquee.y1);
  return Object.entries(rects)
    .filter(
      ([, rect]) =>
        rect.x < x1 &&
        rect.x + rect.width > x0 &&
        rect.y < y1 &&
        rect.y + rect.height > y0,
    )
    .map(([id]) => id as EntityId);
}
