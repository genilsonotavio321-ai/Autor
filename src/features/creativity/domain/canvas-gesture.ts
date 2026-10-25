import type { EntityId, IdeaCard } from "@/shared/types/database";

/** Movimento (px) antes do toque virar arraste — tolerância herdada do dnd-kit. */
export const DRAG_SLOP_PX = 6;

/** Tempo parado (ms) até o toque virar hold (seleciona o card). */
export const HOLD_MS = 300;

export type GesturePoint = { x: number; y: number };

/** Evento mínimo que o tracker entende — sem DOM, para testar puro. */
export type GestureEvent = GesturePoint & { pointerId: number };

export type GestureHandlers = {
  /** Toque rápido sem movimento: abre o card (ou alterna seleção). */
  onTap?: (point: GesturePoint) => void;
  /** Pressão parada: seleciona o card. */
  onHold?: (point: GesturePoint) => void;
  onDragStart?: (point: GesturePoint) => void;
  onDragMove?: (point: GesturePoint) => void;
  /** Fim do arraste: persiste o movimento do lote. */
  onDragEnd?: (point: GesturePoint) => void;
  /** pointercancel/blur no meio do arraste: descarta o movimento. */
  onDragCancel?: () => void;
};

export type GestureConfig = GestureHandlers & {
  /** Hold mais curto (alças usam 0: arraste puro, sem tap/hold). */
  holdMs?: number;
  slopPx?: number;
  /**
   * true (cards): após o hold o gesto trava em seleção — mover não arrasta,
   * evita drag acidental com a toolbar aberta. Alças passam false.
   */
  lockAfterHold?: boolean;
};

export type GestureTracker = {
  start: (event: GestureEvent) => void;
  move: (event: GestureEvent) => void;
  end: (event: GestureEvent) => void;
  cancel: () => void;
};

type State = "idle" | "pending" | "hold" | "drag";

export function createGestureTracker(config: GestureConfig): GestureTracker {
  const holdMs = config.holdMs ?? HOLD_MS;
  const slopPx = config.slopPx ?? DRAG_SLOP_PX;
  const lockAfterHold = config.lockAfterHold ?? true;
  let state: State = "idle";
  let pointerId = -1;
  let start: GesturePoint | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;

  const clearHold = () => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };
  const reset = () => {
    clearHold();
    state = "idle";
    pointerId = -1;
    start = null;
  };
  const distance = (point: GesturePoint) =>
    start ? Math.hypot(point.x - start.x, point.y - start.y) : 0;

  return {
    start(event) {
      // Segundo ponteiro durante um gesto não cria gesto novo.
      if (state !== "idle") return;
      state = "pending";
      pointerId = event.pointerId;
      start = { x: event.x, y: event.y };
      holdTimer = setTimeout(() => {
        if (state !== "pending") return;
        state = "hold";
        config.onHold?.({ x: start!.x, y: start!.y });
      }, holdMs);
    },
    move(event) {
      if (event.pointerId !== pointerId) return;
      if (state === "pending") {
        // Movimento além do slop vira drag imediato (sem espera de 250ms).
        if (distance(event) <= slopPx) return;
        clearHold();
        state = "drag";
        config.onDragStart?.({ x: event.x, y: event.y });
        return;
      }
      if (state === "drag") {
        config.onDragMove?.({ x: event.x, y: event.y });
        return;
      }
      // Hold travado: mover não arrasta (política do card). Alça segue livre.
      if (state === "hold" && !lockAfterHold && distance(event) > slopPx) {
        state = "drag";
        config.onDragStart?.({ x: event.x, y: event.y });
      }
    },
    end(event) {
      if (event.pointerId !== pointerId) return;
      if (state === "pending") config.onTap?.({ x: event.x, y: event.y });
      else if (state === "drag") config.onDragEnd?.({ x: event.x, y: event.y });
      // Hold: up encerra sem ação — a seleção já foi feita no timer.
      reset();
    },
    cancel() {
      if (state === "idle") return;
      if (state === "drag") config.onDragCancel?.();
      reset();
    },
  };
}

/**
 * Ids que arrastam junto com o card pego: grupo persistente inteiro;
 * fora dele, a seleção múltipla (se o card pego participa); sozinho, só ele.
 */
export function dragIdsFor(
  card: Pick<IdeaCard, "id" | "groupId">,
  cards: readonly IdeaCard[],
  selection: ReadonlySet<EntityId>,
): EntityId[] {
  if (card.groupId) {
    const ids = cards
      .filter((item) => item.groupId === card.groupId)
      .map((item) => item.id);
    if (ids.length > 0) return ids;
  }
  if (selection.has(card.id)) {
    return cards
      .filter((item) => selection.has(item.id))
      .map((item) => item.id);
  }
  return [card.id];
}
