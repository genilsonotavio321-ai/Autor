"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import type { EntityId } from "@/shared/types/database";

import { resolveHintMode, type FolderHintMode } from "../application/folder-drag";

const HINT_LABELS: Record<Exclude<FolderHintMode, null>, string> = {
  create: "Solte para criar uma pasta",
  add: "Solte para adicionar à pasta",
  nested: "Solte para colocar a pasta dentro",
  exit: "Solte para tirar da pasta",
};

/** Ponto inicial do arrasto — PointerSensor/Mouse (clientX/Y) ou Touch. */
function eventPoint(event: Event): { x: number; y: number } | null {
  if (typeof (event as PointerEvent).clientX === "number") {
    return {
      x: (event as PointerEvent).clientX,
      y: (event as PointerEvent).clientY,
    };
  }
  const touch =
    (event as TouchEvent).touches?.[0] ??
    (event as TouchEvent).changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return null;
}

/**
 * Texto flutuante que segue o dedo/mouse durante um arrasto e avisa o que
 * soltar o card vai fazer (fade-in/out em ~200ms). A posição é escrita
 * direto no DOM: o onDragMove constante não causa re-render — só
 * transform/opacity, que animam em composite sem jank.
 */
export function useFolderDragHint({
  viewFolderIds,
}: {
  /** Pastas visíveis na pasta aberta (mesma lista do SortableContext). */
  viewFolderIds: EntityId[];
}) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<FolderHintMode>(null);

  const place = useCallback(
    (activatorEvent: Event, delta?: { x?: number; y?: number }) => {
      const node = labelRef.current;
      if (!node) return;
      const start = eventPoint(activatorEvent);
      if (!start) return;
      const x = start.x + (delta?.x ?? 0);
      const y = start.y + (delta?.y ?? 0);
      // Acima do dedo/cursor, centrado no próprio texto.
      node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -130%)`;
    },
    [],
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      place(event.activatorEvent);
      setMode(null);
    },
    [place],
  );

  const onDragMove = useCallback(
    (event: DragMoveEvent) => {
      place(event.activatorEvent, event.delta);
    },
    [place],
  );

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      setMode(
        resolveHintMode({
          viewFolderIds,
          activeId: String(event.active.id),
          overId: event.over ? String(event.over.id) : undefined,
          activeRect: event.active.rect.current.translated,
          overRect: event.over?.rect ?? null,
        }),
      );
    },
    [viewFolderIds],
  );

  const onDragEnd = useCallback(() => setMode(null), []);
  const onDragCancel = useCallback(() => setMode(null), []);

  const hint = useMemo(
    () => (
      <div
        ref={labelRef}
        aria-hidden
        className={`pointer-events-none fixed top-0 left-0 z-50 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md transition-opacity duration-200 ${
          mode === null ? "opacity-0" : "opacity-75"
        }`}
      >
        {mode === null ? "" : HINT_LABELS[mode]}
      </div>
    ),
    [mode],
  );

  return {
    /** Modo atual — páginas usam p/ acender o ring do card alvo. */
    mode,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
    onDragCancel,
    hint,
  };
}
